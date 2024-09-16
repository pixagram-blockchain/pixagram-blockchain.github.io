import init, { CameraProcessor } from "wasm-camera-qr";

/**
 * QrScanner — camera QR scanning on top of wasm-camera-qr.
 *
 * Three things changed structurally from the previous version:
 *
 * 1. **There is no display canvas.** The `<video>` element you hand to
 *    `attach()` is what the user sees, composited by the browser for free. The
 *    old path decoded a frame, uploaded it to the GPU, pulled it back as an
 *    ImageBitmap and transferred it into a canvas — a full round trip to
 *    reproduce a picture the compositor already had. An optional overlay canvas
 *    draws the tracking quad, and nothing else.
 *
 * 2. **Pixels reach wasm as 8bpp luma where the browser allows it.** A camera
 *    `VideoFrame` is normally I420 or NV12, whose plane 0 *is* the luma plane, so
 *    `copyTo()` gives us the greyscale image with no colour conversion and a
 *    quarter of the RGBA byte count. Where `MediaStreamTrackProcessor` is
 *    missing (Safari, Firefox at time of writing) we fall back to the canvas
 *    path, which still works and is what shipped before.
 *
 * 3. **There is no scan mode.** rqrr resolves mirroring and rotation by itself —
 *    measured across four rotations x mirrored/not x four payloads, all decoded
 *    by a single pass. The old `normal`/`both`/`reversed`/`mixed` setting was
 *    choosing between one pass and two passes that did the same job, and `both`
 *    was the default. Deleting it halves the cost of every frame that *doesn't*
 *    contain a readable code, which is nearly all of them while the user aims.
 *
 * Neither path needs SharedArrayBuffer, so no COOP/COEP headers and no CORP
 * requirement on cross-origin images.
 */

/** Rust status codes, mirrored so callers don't hardcode integers. */
export const STATUS = { NONE: 0, LOCATED: 1, DECODED: 2 };

/**
 * Pixel formats whose first plane is a full-resolution luma plane. Anything
 * else (RGBA, BGRA) has no luma to steal, so we use the canvas path instead.
 */
const LUMA_FIRST = /^(I420|I422|I444|NV12)/;

const DEFAULTS = {
    /** Long edge of the analysis buffer on the canvas path. Detection cost is
     *  linear in pixels, and 640 finds a code held at arm's length. */
    analysisWidth: 640,
    /** ms between scan attempts. */
    scanInterval: 160,
    /** Centred search region, as a fraction of the frame's short edge. Keep this
     *  equal to whatever reticle the UI draws. */
    roi: 0.75,
    /** Suppress repeats of the same payload for this long. */
    dedupeMs: 2000,
    /** How long to wait for the video element to report its dimensions. */
    metadataTimeout: 10000,
    trackColor: "rgba(255,255,255,0.85)",
    hitColor: "#3ddc84",
};

export class QrScanner {
    /** Whether the device exposes any video input at all. */
    static async hasCamera() {
        if (!navigator.mediaDevices?.enumerateDevices) return false;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.some((d) => d.kind === "videoinput");
        } catch {
            return false;
        }
    }

    /**
     * Video inputs, as `{ id, label }`. Labels are blank until camera
     * permission has been granted once, so call this *after* `open()`.
     */
    static async listCameras() {
        if (!navigator.mediaDevices?.enumerateDevices) return [];
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices
                .filter((d) => d.kind === "videoinput")
                .map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` }));
        } catch {
            return [];
        }
    }

    constructor(options = {}) {
        const opts = { ...DEFAULTS, ...options };

        this.analysisWidth = opts.analysisWidth;
        this.scanInterval = opts.scanInterval;
        this.roi = opts.roi;
        this.dedupeMs = opts.dedupeMs;
        this.metadataTimeout = opts.metadataTimeout;
        this.trackColor = opts.trackColor;
        this.hitColor = opts.hitColor;

        /** Called with the decoded payload. */
        this.onResult = opts.onResult || null;
        /** Called every scan with `{ status, corners, escalated }`. Use it to
         *  drive UI state — `LOCATED` means "code in frame, can't read it",
         *  which is the difference between "hold still" and "point at a code". */
        this.onTrack = opts.onTrack || null;
        /** Called with an Error when the camera can't be opened. */
        this.onError = opts.onError || null;

        this.video = null;
        this.overlay = null;
        this.stream = null;
        this.processor = null;
        this.memory = null;

        this._overlayCtx = null;
        this._canvas = null; // analysis OffscreenCanvas, canvas path only
        this._ctx = null;

        this._running = false;
        this._destroyed = false;
        this._useWebCodecs =
            typeof MediaStreamTrackProcessor !== "undefined" && typeof VideoFrame !== "undefined";

        this._reader = null;
        this._rvfc = null;
        this._raf = null;

        this._bufW = 0;
        this._bufH = 0;
        this._lumaView = null;
        this._rgbaView = null;
        this._cornerView = null;

        this._lastScan = 0;
        this._lastHit = null;
        this._lastHitAt = 0;

        this._onVideoResize = () => {
            // Rotating the device swaps videoWidth/videoHeight. Zeroing the
            // cached dimensions makes the next scan re-derive and resize.
            this._bufW = 0;
            this._bufH = 0;
        };
    }

    /**
     * Wire up the DOM. `video` is the element the user sees — style it yourself
     * (`object-fit: cover` is usually what you want). `overlay` is an optional
     * canvas for the tracking quad; size it with CSS to exactly cover the video
     * and give it the same `object-fit`, and the coordinates line up without any
     * transform maths on your side.
     */
    attach({ video, overlay = null }) {
        if (!video) throw new Error("QrScanner: attach() needs a video element");

        if (this.video) this.video.removeEventListener("resize", this._onVideoResize);

        this.video = video;
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.muted = true;
        video.autoplay = true;
        video.addEventListener("resize", this._onVideoResize);

        this.overlay = overlay;
        this._overlayCtx = overlay ? overlay.getContext("2d") : null;
        return this;
    }

    /**
     * Start the wasm module and the camera **concurrently**.
     *
     * These are independent, and the permission prompt is by far the longer of
     * the two. Racing them means the module is nearly always compiled before the
     * user taps Allow, so the download costs no wall-clock time at all — this is
     * the largest single perceived-load-time win available here.
     */
    async open({ deviceId = null } = {}) {
        if (this._destroyed) throw new Error("QrScanner: already destroyed");
        if (!this.video) throw new Error("QrScanner: call attach() before open()");

        this.close();

        const settled = await Promise.allSettled([this._initWasm(), this._openStream(deviceId)]);
        const [wasmRes, streamRes] = settled;

        // Never leave a stream running because the other half failed — that's how
        // you end up with the camera indicator stuck on.
        if (wasmRes.status === "rejected" || streamRes.status === "rejected") {
            if (streamRes.status === "fulfilled") stopStream(streamRes.value);
            const err = (wasmRes.reason || streamRes.reason) ?? new Error("QrScanner: open failed");
            if (this.onError) this.onError(err);
            throw err;
        }

        if (this._destroyed) {
            stopStream(streamRes.value);
            return false;
        }

        this.stream = streamRes.value;
        this.video.srcObject = this.stream;

        this.setRoi(this.roi);

        this._applyContinuousFocus();

        try {
            await this._awaitMetadata();
            await this.video.play();
        } catch (err) {
            this.close();
            if (this.onError) this.onError(err);
            throw err;
        }

        if (this._destroyed) {
            this.close();
            return false;
        }

        this._running = true;
        this._lastScan = 0;
        this._lastHit = null;

        if (this._useWebCodecs) this._runLumaLoop();
        else this._runCanvasLoop();

        return true;
    }

    /** Stop scanning and release the camera. The wasm module stays loaded, so
     *  reopening is instant. */
    close() {
        this._running = false;

        if (this._rvfc !== null && this.video?.cancelVideoFrameCallback) {
            this.video.cancelVideoFrameCallback(this._rvfc);
        }
        if (this._raf !== null) cancelAnimationFrame(this._raf);
        this._rvfc = null;
        this._raf = null;

        if (this._reader) {
            this._reader.cancel().catch(() => {});
            this._reader = null;
        }

        stopStream(this.stream);
        this.stream = null;

        if (this.video) {
            try {
                this.video.pause();
            } catch {
                /* already paused */
            }
            this.video.srcObject = null;
        }

        this._clearOverlay();
    }

    /** Irreversible. Frees the wasm processor too. */
    destroy() {
        this.close();
        this._destroyed = true;
        this.onResult = null;
        this.onTrack = null;
        this.onError = null;

        if (this.video) this.video.removeEventListener("resize", this._onVideoResize);

        if (this.processor) {
            try {
                this.processor.free();
            } catch {
                /* already freed */
            }
            this.processor = null;
        }
        this.memory = null;
        this._lumaView = null;
        this._rgbaView = null;
        this._cornerView = null;
        this._canvas = null;
        this._ctx = null;
        this.video = null;
        this.overlay = null;
        this._overlayCtx = null;
    }

    /** Keep this in step with the reticle the UI draws. */
    setRoi(ratio) {
        this.roi = ratio;
        if (this.processor) this.processor.set_roi(ratio);
    }

    get torchSupported() {
        const track = this.stream?.getVideoTracks()[0];
        if (!track?.getCapabilities) return false;
        try {
            return !!track.getCapabilities().torch;
        } catch {
            return false;
        }
    }

    /** Resolves to the state actually achieved, not the state requested. */
    async setTorch(on) {
        const track = this.stream?.getVideoTracks()[0];
        if (!track) return false;
        try {
            await track.applyConstraints({ advanced: [{ torch: !!on }] });
            return !!on;
        } catch {
            return false;
        }
    }

    get currentDeviceId() {
        const track = this.stream?.getVideoTracks()[0];
        return track?.getSettings?.().deviceId || null;
    }

    // ---------------------------------------------------------------- internals

    async _initWasm() {
        if (this.processor) return;
        const wasm = await init();
        if (this._destroyed) return;
        this.memory = wasm.memory;
        this.processor = CameraProcessor.new();
    }

    async _openStream(deviceId) {
        const attempts = [
            {
                audio: false,
                video: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    facingMode: deviceId ? undefined : { ideal: "environment" },
                    width: { ideal: 1280 },
                    height: { ideal: 960 },
                },
            },
            // Drop the resolution hints — some Android cameras reject the
            // combination rather than negotiating down.
            { audio: false, video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" } },
            { audio: false, video: true },
        ];

        let lastErr;
        for (const constraints of attempts) {
            try {
                return await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                lastErr = err;
                // A denied permission won't become granted on the next attempt.
                if (err?.name === "NotAllowedError" || err?.name === "SecurityError") break;
            }
        }
        throw lastErr || new Error("QrScanner: no camera available");
    }

    _awaitMetadata() {
        const video = this.video;
        if (video.readyState >= 1) return Promise.resolve();

        return new Promise((resolve, reject) => {
            const done = (fn, arg) => {
                clearTimeout(timer);
                video.removeEventListener("loadedmetadata", ok);
                video.removeEventListener("error", fail);
                fn(arg);
            };
            const ok = () => done(resolve);
            const fail = () => done(reject, new Error("QrScanner: video failed to load"));
            const timer = setTimeout(
                () => done(reject, new Error("QrScanner: timed out waiting for video metadata")),
                this.metadataTimeout,
            );
            video.addEventListener("loadedmetadata", ok);
            video.addEventListener("error", fail);
        });
    }

    async _applyContinuousFocus() {
        const track = this.stream?.getVideoTracks()[0];
        if (!track?.getCapabilities) return;
        try {
            const caps = track.getCapabilities();
            if (caps.focusMode?.includes("continuous")) {
                await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
            }
        } catch {
            /* not supported; the default is usually continuous anyway */
        }
    }

    // --- ingest path A: WebCodecs, 8bpp luma, no colour conversion -----------

    async _runLumaLoop() {
        const track = this.stream?.getVideoTracks()[0];
        if (!track) return;

        let reader;
        try {
            reader = new MediaStreamTrackProcessor({ track }).readable.getReader();
        } catch (err) {
            console.warn("QrScanner: MediaStreamTrackProcessor unavailable, using canvas path", err);
            this._useWebCodecs = false;
            this._runCanvasLoop();
            return;
        }
        this._reader = reader;

        while (this._running) {
            let frame;
            try {
                const { value, done } = await reader.read();
                if (done) break;
                frame = value;
            } catch {
                break; // cancelled by close()
            }

            try {
                if (!LUMA_FIRST.test(frame.format || "")) {
                    // An RGBA frame has no luma plane to steal. Hand off once and
                    // don't come back.
                    this._useWebCodecs = false;
                    this._reader = null;
                    reader.cancel().catch(() => {});
                    if (this._running) this._runCanvasLoop();
                    return;
                }

                const now = performance.now();
                if (now - this._lastScan >= this.scanInterval) {
                    this._lastScan = now;
                    await this._scanVideoFrame(frame);
                }
            } catch (err) {
                console.warn("QrScanner: frame scan failed", err);
            } finally {
                // Frames are backed by real GPU/CPU buffers. Not closing them
                // stalls the whole pipeline within a handful of frames.
                frame.close();
            }
        }
    }

    async _scanVideoFrame(frame) {
        const rect = frame.visibleRect;
        const w = Math.round(rect?.width || frame.displayWidth || 0);
        const h = Math.round(rect?.height || frame.displayHeight || 0);
        if (!w || !h) return;

        this._ensureDimensions(w, h);

        // A full I420 frame is 1.5x the luma plane and copyTo() writes every
        // plane, so the destination has to hold all of it. Rust reads plane 0.
        const capacity = this.processor.reserve_input(frame.allocationSize());
        const ptr = this.processor.luma_ptr();
        let view = this._lumaView;
        if (
            !view ||
            view.buffer !== this.memory.buffer ||
            view.byteOffset !== ptr ||
            view.length !== capacity
        ) {
            view = this._lumaView = new Uint8Array(this.memory.buffer, ptr, capacity);
        }

        const layout = await frame.copyTo(view);
        if (!this._running) return;
        if (view.buffer !== this.memory.buffer) {
            // Memory grew underneath us; the view is detached. Skip this frame.
            this._lumaView = null;
            return;
        }

        // Use the layout copyTo() actually resolved rather than assuming a
        // tightly packed plane — some implementations pad the stride.
        const plane = layout?.[0];
        this.processor.set_input_layout(plane?.offset ?? 0, plane?.stride ?? w);

        this._consume(this.processor.scan());
    }

    // --- ingest path B: canvas 2D, RGBA + conversion in wasm -----------------

    _runCanvasLoop() {
        if (!this._canvas) {
            this._canvas = new OffscreenCanvas(1, 1);
            this._ctx = this._canvas.getContext("2d", {
                willReadFrequently: true,
                alpha: false,
                desynchronized: true,
            });
        }

        const step = () => {
            this._rvfc = null;
            this._raf = null;
            if (!this._running) return;

            const now = performance.now();
            if (now - this._lastScan >= this.scanInterval) {
                this._lastScan = now;
                try {
                    this._scanCanvasFrame();
                } catch (err) {
                    console.warn("QrScanner: frame scan failed", err);
                }
            }
            this._schedule(step);
        };

        this._schedule(step);
    }

    _schedule(fn) {
        // requestVideoFrameCallback fires once per *new* camera frame, so a
        // 120 Hz display doesn't cost twice as many wake-ups as a 60 Hz one. It
        // pauses with the tab, same as rAF.
        if (this.video?.requestVideoFrameCallback) {
            this._rvfc = this.video.requestVideoFrameCallback(fn);
        } else {
            this._raf = requestAnimationFrame(fn);
        }
    }

    _scanCanvasFrame() {
        const vw = this.video?.videoWidth || 0;
        const vh = this.video?.videoHeight || 0;
        if (!vw || !vh) return;

        const scale = Math.min(1, this.analysisWidth / Math.max(vw, vh));
        const w = Math.max(1, Math.round(vw * scale));
        const h = Math.max(1, Math.round(vh * scale));

        if (w !== this._bufW || h !== this._bufH) {
            this._canvas.width = w;
            this._canvas.height = h;
        }
        this._ensureDimensions(w, h);

        this._ctx.drawImage(this.video, 0, 0, w, h);
        const { data } = this._ctx.getImageData(0, 0, w, h);

        const ptr = this.processor.rgba_ptr();
        const len = w * h * 4;
        let view = this._rgbaView;
        if (
            !view ||
            view.buffer !== this.memory.buffer ||
            view.byteOffset !== ptr ||
            view.length !== len
        ) {
            view = this._rgbaView = new Uint8Array(this.memory.buffer, ptr, len);
        }
        view.set(data);

        this.processor.convert_rgba();
        this._consume(this.processor.scan());
    }

    // --- shared ---------------------------------------------------------------

    _ensureDimensions(w, h) {
        if (w === this._bufW && h === this._bufH) return;
        this.processor.resize(w, h);
        this._bufW = w;
        this._bufH = h;
        // resize() reallocates, so every cached view is stale.
        this._lumaView = null;
        this._rgbaView = null;
        if (this.overlay) {
            // Sizing the overlay to the analysis buffer means corner coordinates
            // need no transform: give the canvas the same CSS box and object-fit
            // as the video and the browser applies the identical mapping to both.
            this.overlay.width = w;
            this.overlay.height = h;
        }
    }

    _readCorners() {
        const ptr = this.processor.corners_ptr();
        let c = this._cornerView;
        if (!c || c.buffer !== this.memory.buffer || c.byteOffset !== ptr) {
            c = this._cornerView = new Uint16Array(this.memory.buffer, ptr, 8);
        }
        // Copied out: wasm reuses this buffer on the next scan.
        return [
            [c[0], c[1]],
            [c[2], c[3]],
            [c[4], c[5]],
            [c[6], c[7]],
        ];
    }

    _consume(text) {
        const status = this.processor.status;
        const corners = status === STATUS.NONE ? null : this._readCorners();

        this._paintOverlay(status, corners);

        if (this.onTrack) {
            this.onTrack({ status, corners, escalated: this.processor.escalated });
        }

        if (!text) return;

        // The same code stays in frame for many scans. Fire once.
        const now = performance.now();
        if (text === this._lastHit && now - this._lastHitAt < this.dedupeMs) {
            this._lastHitAt = now;
            return;
        }
        this._lastHit = text;
        this._lastHitAt = now;
        if (this.onResult) this.onResult(text);
    }

    _paintOverlay(status, corners) {
        const ctx = this._overlayCtx;
        if (!ctx || !this.overlay) return;

        ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
        if (!corners) return;

        ctx.lineWidth = Math.max(2, Math.round(this.overlay.width / 100));
        ctx.lineJoin = "round";
        ctx.strokeStyle = status === STATUS.DECODED ? this.hitColor : this.trackColor;
        ctx.beginPath();
        ctx.moveTo(corners[0][0], corners[0][1]);
        for (let i = 1; i < 4; i++) ctx.lineTo(corners[i][0], corners[i][1]);
        ctx.closePath();
        ctx.stroke();
    }

    _clearOverlay() {
        if (this._overlayCtx && this.overlay) {
            this._overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
        }
    }
}

function stopStream(stream) {
    if (!stream) return;
    for (const track of stream.getTracks()) {
        try {
            track.stop();
        } catch {
            /* already stopped */
        }
    }
}

export default QrScanner;