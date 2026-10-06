/**
 * pixa-translate — browser client for the Pixagram translation Worker.
 * No dependencies. Works with any framework (see use-translation.js for Preact).
 *
 *   import { createTranslator } from './pixa-translate.js';
 *   const translator = createTranslator({ endpoint: 'https://translate.pixagram.com' });
 *   const result = await translator.translate(post.body, {
 *     target: 'fr',
 *     onProgress: ({ markdown, done, total }) => render(markdown),  // partial document
 *     signal: abortController.signal,
 *   });
 *   render(result.markdown);
 */

export class TranslateError extends Error {
  constructor(code, message, retryAfter = 0) {
    super(message);
    this.name = 'TranslateError';
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

async function* readSse(body) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buf += value.replace(/\r\n?/g, '\n');
      let cut;
      while ((cut = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, cut);
        buf = buf.slice(cut + 2);
        let event = 'message';
        let data = '';
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trimStart();
        }
        if (data) yield { event, data: JSON.parse(data) };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Invisible Cloudflare Turnstile, only used when the Worker runs with REQUIRE_SESSION=true. */
function turnstileToken(siteKey) {
  const load = () =>
    window.turnstile
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          s.async = true;
          s.onload = resolve;
          s.onerror = () => reject(new TranslateError('challenge_failed', 'could not load the browser check'));
          document.head.append(s);
        });
  return load().then(
    () =>
      new Promise((resolve, reject) => {
        const box = document.createElement('div');
        box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647';
        document.body.append(box);
        const done = (fn, v) => {
          window.turnstile.remove(id);
          box.remove();
          fn(v);
        };
        const id = window.turnstile.render(box, {
          sitekey: siteKey,
          appearance: 'interaction-only',
          callback: (token) => done(resolve, token),
          'error-callback': () => done(reject, new TranslateError('challenge_failed', 'the browser check failed')),
        });
      }),
  );
}

/**
 * @param {{
 *   endpoint: string,               // Worker URL, e.g. https://translate.pixagram.com
 *   turnstileSiteKey?: string,      // only with REQUIRE_SESSION=true on the Worker
 *   getTurnstileToken?: () => Promise<string>,  // bring your own widget instead of the built-in one
 *   fetch?: typeof fetch,           // for tests
 * }} options
 */
export function createTranslator({ endpoint, turnstileSiteKey = '', getTurnstileToken, fetch: fetchImpl } = {}) {
  const base = String(endpoint || '').replace(/\/+$/, '');
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  // The server decides whether a session is still valid (the device clock may be wrong):
  // the token is always sent, and replaced once when the Worker answers session_required.
  let session = null; // { token, expires }

  async function newSession() {
    if (!getTurnstileToken && !turnstileSiteKey) {
      throw new TranslateError('session_required', 'this translator needs a Turnstile site key');
    }
    const turnstileToken_ = getTurnstileToken ? await getTurnstileToken() : await turnstileToken(turnstileSiteKey);
    const res = await doFetch(`${base}/v1/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnstileToken: turnstileToken_ }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new TranslateError(body.error?.code || 'session_failed', body.error?.message || `HTTP ${res.status}`);
    session = { token: body.session, expires: body.expires };
  }

  async function request(payload, signal) {
    const headers = { 'Content-Type': 'application/json' };
    if (session) headers.Authorization = `Bearer ${session.token}`;
    return doFetch(`${base}/v1/translate`, { method: 'POST', headers, body: JSON.stringify(payload), signal });
  }

  /**
   * Translate a markdown document.
   * @param {string} markdown
   * @param {{
   *   target: string, source?: string, signal?: AbortSignal,
   *   onProgress?: (p: {markdown: string, done: number, total: number, index: number, status: string}) => void,
   *   onStatus?: (s: {state: 'starting'|'busy', retryIn: number}) => void,
   * }} options
   * @returns {Promise<{markdown: string, source: string, target: string, partial: boolean, cached: boolean}>}
   */
  async function translate(markdown, { target, source = 'auto', signal, onProgress, onStatus } = {}) {
    const payload = { markdown, target, source, stream: true };
    let res = await request(payload, signal);
    if (res.status === 401) {
      const err = await res.json().catch(() => ({}));
      if (err.error?.code !== 'session_required') throw new TranslateError('unauthorized', err.error?.message || 'unauthorized');
      session = null;
      await newSession(); // one fresh session, one retry
      res = await request(payload, signal);
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new TranslateError(err.error?.code || `http_${res.status}`, err.error?.message || `HTTP ${res.status}`,
        Number(res.headers.get('Retry-After')) || 0);
    }

    let parts = null;
    let current = null;
    let total = 0;
    let done = 0;
    const assemble = () => parts.map((p) => (typeof p === 'number' ? current[p] : p)).join('');

    for await (const { event, data } of readSse(res.body)) {
      if (event === 'start') {
        total = data.segments;
        if (data.parts) {
          parts = data.parts;
          current = data.sources.slice();
        }
      } else if (event === 'seg' && parts) {
        current[data.i] = data.md;
        done++;
        onProgress?.({ markdown: assemble(), done, total, index: data.i, status: data.status });
      } else if (event === 'status') {
        onStatus?.(data);
      } else if (event === 'done') {
        return data;
      } else if (event === 'error') {
        throw new TranslateError(data.code, data.message);
      }
    }
    throw new TranslateError('interrupted', 'the connection was interrupted');
  }

  async function languages() {
    const res = await doFetch(`${base}/v1/languages`);
    if (!res.ok) throw new TranslateError(`http_${res.status}`, 'could not load languages');
    return (await res.json()).languages;
  }

  return { translate, languages };
}
