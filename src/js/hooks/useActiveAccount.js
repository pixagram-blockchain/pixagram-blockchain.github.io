import { useState, useEffect, useRef, useCallback } from "preact/compat";

// ── useActiveAccount ────────────────────────────────────────────────────
// One source of truth for "who is logged in" on a page, shared by Feed,
// FeedPersonal, Community and Profile.
//
// Why this exists. Each page used to resolve the active account in TWO
// places: inside its data load (Promise.all([getActiveAccount(), posts…]))
// and in a session-event listener. Neither was ordered against the other,
// so this sequence was common on a cold start:
//
//   1. loadPage starts, getActiveAccount() resolves null (vault still
//      restoring), the post fetch keeps going;
//   2. `session_restored` fires → the listener sets loggedInUser = "alice";
//   3. the post fetch lands → loadPage commits the null it read in step 1.
//
// The vote buttons then stayed inert (voter = null) until the next
// navigation. The SWR view cache made it worse: a return visit replayed the
// `loggedInUser` stored with the cached list, which could be a stale null.
//
// Here every read takes a sequence number and only the newest one commits,
// so a slow early read can never overwrite a later one. On top of the
// session events it also:
//   • re-reads shortly after each event (some sessions report the account
//     a beat after the event fires),
//   • polls while the api is still initializing, and for a short window
//     after mount while the answer is still "nobody" (a session restored
//     without emitting anything is caught there),
//   • re-reads when the tab regains focus / visibility.
//
// Returns { user, resolved, refresh }:
//   user      — account name or null
//   resolved  — false until the first real answer (api initialized)
//   refresh() — force a re-read; resolves with the answer

const SESSION_EVENTS = [
    "session_created", "session_restored", "session_resumed", "session_ended",
    "account_switched", "pin_unlocked", "pin_locked",
];

const NOT_READY_POLL_MS = 400;       // api still initializing
const NOBODY_POLL_MS = 1500;         // initialized, nobody logged in yet
const NOBODY_POLL_WINDOW_MS = 20000; // …for this long after mount
const EVENT_FOLLOW_UPS_MS = [500, 1500];
const READ_TIMEOUT_MS = 8000;

const withTimeout = (p, ms) => new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, ms);
    Promise.resolve(p).then(
        (v) => { if (!done) { done = true; clearTimeout(t); resolve(v); } },
        () => { if (!done) { done = true; clearTimeout(t); resolve(null); } },
    );
});

const normalize = (u) => {
    if (typeof u === "string") return u || null;
    if (u && typeof u.name === "string") return u.name || null;
    return null;
};

// `includeLocked`: also accept the key manager's account (known while the
// vault is locked). Community has always shown the viewer that way.
const readActiveAccount = async (api, includeLocked) => {
    let u = null;
    if (typeof api.getActiveAccount === "function") {
        u = normalize(await withTimeout(api.getActiveAccount(), READ_TIMEOUT_MS));
    }
    if (!u && api.sessionManager && typeof api.sessionManager.getActiveAccount === "function") {
        u = normalize(await withTimeout(api.sessionManager.getActiveAccount(), READ_TIMEOUT_MS));
    }
    if (!u && includeLocked && api.keyManager && typeof api.keyManager.getActiveAccount === "function") {
        try { u = normalize(api.keyManager.getActiveAccount()); } catch (e) { u = null; }
    }
    return u;
};

const subscribeTo = (api, events, fn) => {
    const em = api && api.eventEmitter && typeof api.eventEmitter.on === "function" ? api.eventEmitter
        : api && typeof api.on === "function" ? api : null;
    if (!em) return () => {};
    events.forEach((ev) => em.on(ev, fn));
    return () => events.forEach((ev) => { try { em.off(ev, fn); } catch (e) {} });
};

export default function useActiveAccount(api, options) {
    const includeLocked = !!(options && options.includeLocked);
    const [state, setState] = useState({ user: null, resolved: false });
    const apiRef = useRef(api);
    apiRef.current = api;
    const seqRef = useRef(0);

    // Resolves with the account (string | null), or `undefined` while the
    // api isn't initialized yet (nothing committed in that case).
    const refresh = useCallback(async () => {
        const a = apiRef.current;
        if (!a || !a.initialized) return undefined;
        const seq = ++seqRef.current;
        let u = null;
        try { u = await readActiveAccount(a, includeLocked); } catch (e) { u = null; }
        // A newer read started meanwhile — it owns the answer.
        if (seq !== seqRef.current) return u;
        setState((prev) => (prev.resolved && prev.user === u ? prev : { user: u, resolved: true }));
        return u;
    }, [includeLocked]);

    useEffect(() => {
        if (!api) return undefined;
        let alive = true;
        const timers = new Set();
        const later = (fn, ms) => {
            const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms);
            timers.add(t);
        };

        // Initial read + polling (see header).
        const startedAt = Date.now();
        const tick = async () => {
            if (!alive) return;
            const u = await refresh();
            if (!alive) return;
            if (u === undefined) later(tick, NOT_READY_POLL_MS);
            else if (u === null && Date.now() - startedAt < NOBODY_POLL_WINDOW_MS) later(tick, NOBODY_POLL_MS);
        };
        tick();

        // Session events: read now, and again a moment later.
        const onSession = () => {
            refresh();
            EVENT_FOLLOW_UPS_MS.forEach((ms) => later(refresh, ms));
        };
        const unsubscribe = subscribeTo(api, SESSION_EVENTS, onSession);

        const onVisible = () => {
            if (typeof document === "undefined" || document.visibilityState !== "hidden") refresh();
        };
        if (typeof window !== "undefined") window.addEventListener("focus", onVisible);
        if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);

        return () => {
            alive = false;
            timers.forEach(clearTimeout);
            timers.clear();
            unsubscribe();
            if (typeof window !== "undefined") window.removeEventListener("focus", onVisible);
            if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
        };
    }, [api, refresh]);

    return { user: state.user, resolved: state.resolved, refresh };
}
