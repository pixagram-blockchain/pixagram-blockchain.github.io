// ============================================================================
// ImageWizard.js — Shrink an oversized picture down to the on-chain budget
//
// Opened by EditProfileDialog / EditCommunityDialog when the user picks an
// avatar that is over the metadata limit (48 kB) OR fails the pixel-art
// probe (isArtworkPixelart, same as NewPost). Mirrors the NewPost flow:
//
//   1. "Transform your picture with AI?" — same white dialog as NewPost.
//      The two AI styles are contained buttons in the BODY ("VGA STYLE" →
//      style "vga", "RETRO ART" → style "retroart"); the actions bar holds
//      only "No, I don't want" (= convert without AI).
//      (Skipped when the upload is already pixel art: the file is just badly
//      encoded, so we jump straight to Adjust.)
//   2. Pixel-art conversion via utils/pix2art (with or without AI), with the
//      same PIXIFYING loader (ring + sparkles + quips) as NewPost.
//   3. Adjust — pick a size preset and/or tune color quantization (downscale
//      ratio + number of colors, same ranges as NewPost) while a live
//      estimate shows the encoded WEBP weight against the budget.
//
// "Use Picture" hands a fresh File (image/webp, under the budget) back to the
// parent through onComplete(file). The parent re-runs it through its normal
// processFile() path, so the existing 100 kB check stays the single gatekeeper.
//
// Props:
//   open        bool
//   file        File — the oversized image the user picked
//   maxKb       number — budget in kB (default 48, matching file.size > 48000)
//   onClose     () => void — cancel, keep the previous avatar
//   onComplete  (file: File) => void — optimized file ready to use
// ============================================================================

import * as React from "preact/compat";
import { useState, useCallback, useMemo, useEffect, useRef, useLayoutEffect } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import FormControl from "@material-ui/core/FormControl";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import RadioGroup from "@material-ui/core/RadioGroup";
import Radio from "@material-ui/core/Radio";
import Slider from "@material-ui/core/Slider";
import Fade from "@material-ui/core/Fade";
import { isArtworkPixelart, processImageFile, quantizeImageData } from "../utils/pix2art/file2imgd";
import JSLoader from "../utils/JSLoader";

import { t } from "../utils/text";
import { T } from "../utils/T";

// ============================================================================
// STYLES — greyscale, matching NewPost's dialog language
// ============================================================================

const styles = theme => ({
    dialog: {
        "& .MuiDialogContent-root": {
            padding: "24px 24px 0px 24px"
        },
        "& div.MuiPaper-rounded.MuiDialog-paper": {
            width: "min(calc(100% - 64px), 640px)",
            maxWidth: "none",
            '@media (max-width: 704px)': {
                width: "100%",
                maxWidth: "none",
                margin: "none"
            }
        }
    },
    whiteDialog: {
        backgroundColor: "#fff !important",
        color: "#000 !important",
        boxShadow: "0px 11px 15px -7px rgb(255 255 255 / 20%), 0px 24px 38px 3px rgb(255 255 255 / 14%), 0px 9px 46px 8px rgb(255 255 255 / 12%) !important",
        "& .MuiButton-textPrimary": {
            color: "#222 !important",
            "&:hover": {
                color: "#000 !important",
            }
        },
        "& .MuiButton-containedPrimary": {
            color: "#fff !important",
            backgroundColor: "#000 !important",
            "&:hover": {
                color: "#ddd !important",
                backgroundColor: "#222 !important",
            }
        },
        "& .MuiRadio-root, & .MuiFormLabel-root.Mui-focused, .MuiTypography-root": {
            color: "#000 !important",
        }
    },
    // Preview stage the input image / loader / result canvas live in.
    stage: {
        width: "100%",
        minHeight: "320px",
        maxHeight: "60vh",
        border: "2px dashed #555",
        borderRadius: "21px",
        textAlign: "center",
        verticalAlign: "middle",
        backgroundColor: "transparent",
        transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 225ms",
        position: "relative",
        overflow: "hidden"
    },
    inputImage: {
        margin: "0px",
        borderRadius: "12px",
        width: "100%",
        height: "100%",
        minHeight: "320px",
        maxHeight: "60vh",
        objectFit: "contain",
        filter: "grayscale(1) contrast(.8) brightness(0.55) opacity(0.65) blur(8px)",
        transition: "filter 400ms cubic-bezier(0.4, 0, 0.2, 1) 25ms !important",
        animationName: "$wizardImagePulse",
        animationTimingFunction: "ease-in-out",
        animationDuration: "2400ms",
        animationFillMode: "both",
        animationDelay: "1200ms",
        animationDirection: "alternate",
        animationIterationCount: "infinite"
    },
    "@keyframes wizardImagePulse": {
        "0%": { opacity: "0.666" },
        "100%": { opacity: "1.000" }
    },
    sizeHeader: {
        padding: "8px 16px 32px 16px",
        margin: "0px 0px -16px 0px",
        borderRadius: "21px 21px 0px 0px",
        background: "#101010",
        width: "100%",
        display: "flow",
        zIndex: 0
    },
    quantizedMessage: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: theme.spacing(2)
    },
    previewCanvas: {
        borderRadius: "0px 0px 21px 21px",
        backgroundColor: "#101010",
        width: "100%",
        maxHeight: "48vh",
        objectFit: "contain"
    },
    sliderContainer: {
        marginTop: theme.spacing(2),
        padding: theme.spacing(2, 3, 4, 3),
        backgroundColor: "#101010",
        borderRadius: "21px",
        "& .MuiSlider-markLabel": {
            color: "#777"
        },
        "& .MuiSlider-markLabelActive": {
            color: "#ccc"
        }
    },
    sliderLabel: {
        fontSize: "0.875rem",
        color: "#bbb",
        marginBottom: theme.spacing(1),
        fontWeight: 500
    },
    errorContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: theme.spacing(6),
        gap: theme.spacing(2),
        textAlign: "center"
    },

    // ── AI conversion loader (same ring + sparkles as NewPost) ─────────────
    "@keyframes wizardStarPop": {
        "0%":   { opacity: 0,    transform: "translate(-50%, -50%) scale(0)" },
        "45%":  { opacity: 1,    transform: "translate(-50%, -50%) scale(1.1)" },
        "62%":  { opacity: 1,    transform: "translate(-50%, -50%) scale(0.84)" },
        "78%":  { opacity: 0.9,  transform: "translate(-50%, -50%) scale(1.04)" },
        "100%": { opacity: 0,    transform: "translate(-50%, -50%) scale(0)" }
    },
    "@keyframes wizardSpin": {
        "0%":   { transform: "rotate(0deg)" },
        "100%": { transform: "rotate(360deg)" }
    },
    "@keyframes wizardBreathe": {
        "0%, 100%": { opacity: 0.9 },
        "50%":      { opacity: 1 }
    },
    loaderOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        animation: "$wizardBreathe 3.4s ease-in-out infinite"
    },
    loaderSquare: {
        position: "relative",
        height: "86%",
        aspectRatio: "1 / 1",
        maxWidth: "92%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
    },
    loaderRing: {
        position: "absolute",
        top: "9%",
        left: "9%",
        width: "82%",
        height: "82%",
        overflow: "visible",
        filter: "drop-shadow(0 0 12px rgba(255,255,255,0.18))"
    },
    loaderComet: {
        position: "absolute",
        top: "9%",
        left: "9%",
        width: "82%",
        height: "82%",
        overflow: "visible",
        transformOrigin: "50% 50%",
        animation: "$wizardSpin 1.25s linear infinite",
        filter: "drop-shadow(0 0 7px rgba(255,255,255,0.55))",
        willChange: "transform"
    },
    loaderStar: {
        position: "absolute",
        color: "#ffffff",
        pointerEvents: "none",
        transform: "translate(-50%, -50%) scale(0)",
        animationName: "$wizardStarPop",
        animationTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        animationIterationCount: "infinite",
        animationFillMode: "both",
        filter: "drop-shadow(0 0 5px rgba(255,255,255,0.55))",
        willChange: "transform, opacity"
    },
    loaderTextWrap: {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "66%",
        textAlign: "center",
        pointerEvents: "none",
        userSelect: "none"
    },
    loaderTitle: {
        color: "#ffffff",
        fontWeight: 700,
        lineHeight: 1.05,
        letterSpacing: "0.14em",
        fontSize: "clamp(17px, 3.1vmin, 30px)",
        textShadow: "0 1px 16px rgba(0,0,0,0.55)"
    },
    loaderSubtitle: {
        marginTop: "0.6em",
        color: "rgba(255,255,255,0.82)",
        fontWeight: 400,
        lineHeight: 1.25,
        letterSpacing: "0.01em",
        fontSize: "clamp(11px, 1.75vmin, 15px)",
        textShadow: "0 1px 12px rgba(0,0,0,0.65)",
        minHeight: "2.5em"
    },
    loaderPercent: {
        position: "absolute",
        bottom: "14px",
        right: "18px",
        zIndex: 13,
        color: "#ffffff",
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.04em",
        fontSize: "clamp(13px, 2vmin, 18px)",
        textShadow: "0 1px 12px rgba(0,0,0,0.7)",
        pointerEvents: "none"
    }
});

// ============================================================================
// LOADER COPY & GEOMETRY — kept identical to NewPost for brand consistency
// ============================================================================

const LOADER_TITLE = "PIXIFYING";

const LOADER_QUIPS = [
    "Teaching pixels some manners…",
    "Summoning tiny squares…",
    "Convincing the AI it went to art school…",
    "Herding stray pixels…",
    "Mixing the perfect palette…",
    "Downscaling, but make it fashion…",
    "Negotiating with the colour wheel…",
    "Polishing every little square…",
    "Sprinkling some 8-bit magic…",
    "Adding a pinch of nostalgia…",
    "Rounding up the right colours…",
    "Asking the pixels very nicely…",
    "Compressing reality, gently…",
    "Buffing the retro shine…",
    "Almost suspiciously pixel-perfect…"
];
const LOADER_QUIP_MS = 1900;

const LOADER_STARS = [
    { top: 13, left: 14, size: 15, delay: 0.0, dur: 2.4 },
    { top: 11, left: 86, size: 11, delay: 0.5, dur: 2.7 },
    { top: 85, left: 17, size: 13, delay: 0.9, dur: 2.5 },
    { top: 70, left: 91, size:  8, delay: 1.4, dur: 2.3 },
    { top:  3, left: 53, size:  9, delay: 0.3, dur: 2.8 },
    { top: 45, left:  3, size:  8, delay: 1.1, dur: 2.5 },
    { top: 30, left: 96, size:  7, delay: 0.7, dur: 2.9 },
    { top: 95, left: 47, size:  9, delay: 1.6, dur: 2.6 }
];

const STAR_PATH = "M12 0.5 Q13.2 10.8 23.5 12 Q13.2 13.2 12 23.5 Q10.8 13.2 0.5 12 Q10.8 10.8 12 0.5 Z";

// ============================================================================
// HELPERS
// ============================================================================

const safeRevokeURL = (url) => {
    if (url && typeof url === 'string' && url.startsWith('blob:')) {
        try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
    }
};

// Same defaults as NewPost's 50% / 50% sliders.
const percentToTransformationSteps = (percent) => Math.round(5 + (percent / 100) * 10);
const percentToFidelity = (percent) => 0.05 + (percent / 100) * 0.45;
const DEFAULT_TRANSFORMATION_STEPS = percentToTransformationSteps(50);
const DEFAULT_FIDELITY = percentToFidelity(50);

// encodeIMG(..., true) returns a base64 string; be defensive in case a
// data-URI prefix ever shows up (the PNG download path suggests it may).
const stripDataUriPrefix = (b64) => {
    if (typeof b64 !== "string") return "";
    const comma = b64.indexOf(",");
    return b64.startsWith("data:") && comma !== -1 ? b64.slice(comma + 1) : b64;
};

const base64ToKb = (raw) => ((raw || "").length || 0) / 1000 * 3 / 4;

const base64ToFile = (raw, filename) => {
    const bin = atob(raw);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], filename, { type: "image/webp" });
};

// ============================================================================
// CONVERSION LOADER — visual twin of NewPost's UploadZone converting state
// ============================================================================

const ConversionLoader = ({ classes, loadingPercent }) => {
    const [quipIndex, setQuipIndex] = useState(() => Math.floor(Math.random() * LOADER_QUIPS.length));

    useEffect(() => {
        const id = setInterval(() => {
            setQuipIndex((i) => (i + 1) % LOADER_QUIPS.length);
        }, LOADER_QUIP_MS);
        return () => clearInterval(id);
    }, []);

    const pct = Math.round(Math.min(Math.max(loadingPercent, 0) * 100, 100));

    const R = 45;
    const C = 2 * Math.PI * R;
    const dashOffset = C * (1 - pct / 100);

    return (
        <Fade in timeout={400}>
            <div className={classes.loaderOverlay}>
                <div className={classes.loaderSquare}>
                    {LOADER_STARS.map((s, i) => (
                        <svg
                            key={i}
                            className={classes.loaderStar}
                            viewBox="0 0 24 24"
                            style={{
                                top: s.top + "%",
                                left: s.left + "%",
                                width: s.size + "%",
                                height: s.size + "%",
                                animationDelay: s.delay + "s",
                                animationDuration: s.dur + "s"
                            }}
                        >
                            <path d={STAR_PATH} fill="currentColor" />
                        </svg>
                    ))}

                    <svg className={classes.loaderRing} viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="3.2" />
                        <circle
                            cx="50" cy="50" r={R}
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="3.6"
                            strokeLinecap="round"
                            strokeDasharray={C}
                            strokeDashoffset={dashOffset}
                            transform="rotate(-90 50 50)"
                            style={{ transition: "stroke-dashoffset 220ms linear" }}
                        />
                    </svg>

                    {pct >= 100 && (
                        <svg className={classes.loaderComet} viewBox="0 0 100 100">
                            <path d="M 34.6 7.7 A 45 45 0 0 1 50 5" fill="none" stroke="#ffffff" strokeWidth="3.6" strokeLinecap="round" opacity="0.85" />
                            <circle cx="50" cy="5" r="2.9" fill="#ffffff" />
                        </svg>
                    )}

                    <div className={classes.loaderTextWrap}>
                        <div className={classes.loaderTitle}>{LOADER_TITLE}</div>
                        <Fade key={quipIndex} in appear timeout={450}>
                            <div className={classes.loaderSubtitle}>{LOADER_QUIPS[quipIndex]}</div>
                        </Fade>
                    </div>
                </div>

                <div className={classes.loaderPercent}>{pct}%</div>
            </div>
        </Fade>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// phase: "idle" → probing the file
//        "ask"  → AI yes/no dialog on top of the blurred input
//        "processing" → pix2art pipeline running (loader)
//        "adjust" → size radios + quantization sliders + live weight
//        "error"
function ImageWizard(props) {
    const { classes, open, onClose, onComplete, file, maxKb = 48 } = props;

    const [phase, setPhase] = useState("idle");
    const [inputFileUrl, setInputFileUrl] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    // Conversion progress (same mechanics as NewPost)
    const [processStart, setProcessStart] = useState(0);
    const [processFinish, setProcessFinish] = useState(0);
    const [, setLoadingTick] = useState(0); // re-render ticker while converting

    // Result / adjust state
    const [processorData, setProcessorData] = useState(null);
    const [availableSizes, setAvailableSizes] = useState([]);
    const [preferredSize, setPreferredSize] = useState("L");
    const [preview, setPreview] = useState(null);
    const [previewCache, setPreviewCache] = useState({});
    const [quantizedData, setQuantizedData] = useState(null);
    const [quantizeDownscale, setQuantizeDownscale] = useState(4);
    const [quantizeColors, setQuantizeColors] = useState(64);

    // Live weight estimate of the encoded WEBP
    const [outKb, setOutKb] = useState(null);
    const [encoding, setEncoding] = useState(false);

    // Refs
    const canvasRef = useRef(null);
    const genRef = useRef(0);            // generation counter — invalidates stale async results
    const quantizeTimerRef = useRef(null);
    const encodeTimerRef = useRef(null);
    const outRawRef = useRef("");        // latest encoded base64 (no data-URI prefix)
    const inputUrlRef = useRef("");

    const maxBytes = maxKb * 1000;
    const dataToUse = quantizedData || preview;

    // ── Reset everything (close / new file) ─────────────────────────────
    const resetState = useCallback(() => {
        genRef.current += 1;
        if (quantizeTimerRef.current) clearTimeout(quantizeTimerRef.current);
        if (encodeTimerRef.current) clearTimeout(encodeTimerRef.current);
        safeRevokeURL(inputUrlRef.current);
        inputUrlRef.current = "";
        outRawRef.current = "";
        setPhase("idle");
        setInputFileUrl("");
        setErrorMsg("");
        setProcessStart(0);
        setProcessFinish(0);
        setProcessorData(null);
        setAvailableSizes([]);
        setPreferredSize("L");
        setPreview(null);
        setPreviewCache({});
        setQuantizedData(null);
        setQuantizeDownscale(4);
        setQuantizeColors(64);
        setOutKb(null);
        setEncoding(false);
    }, []);

    // ── Open: probe the file, then ask about AI (or jump to Adjust) ─────
    useEffect(() => {
        if (!open || !file) {
            resetState();
            return;
        }

        resetState();
        const gen = genRef.current;

        const url = URL.createObjectURL(file);
        inputUrlRef.current = url;
        setInputFileUrl(url);

        (async () => {
            try {
                // Same probe as NewPost: already-pixel-art uploads skip the AI
                // question — the file is just heavy encoding, so re-encoding
                // (plus optional quantization) is all it needs.
                const pixelartImagedata = await isArtworkPixelart(file, 512, 512, 160);
                if (genRef.current !== gen) return;

                if (pixelartImagedata instanceof ImageData) {
                    setProcessorData({
                        canvasWidth: pixelartImagedata.width,
                        canvasHeight: pixelartImagedata.height,
                        cachedBuffer: pixelartImagedata.data,
                        generatePreview: () => pixelartImagedata,
                        availableSizes: ["default"]
                    });
                    setAvailableSizes(["default"]);
                    setPreferredSize("default");
                    setPreview(pixelartImagedata);
                    setPreviewCache({ "default": pixelartImagedata });
                    setPhase("adjust");
                } else {
                    setPhase("ask");
                }
            } catch (error) {
                console.error('[ImageWizard] Error probing file:', error);
                if (genRef.current !== gen) return;
                setErrorMsg(t("components.image_wizard.could_not_read_this_image_please_try"));
                setPhase("error");
            }
        })();

        // Cleanup on unmount only — open/file changes are handled above.
        return () => {
            if (quantizeTimerRef.current) clearTimeout(quantizeTimerRef.current);
            if (encodeTimerRef.current) clearTimeout(encodeTimerRef.current);
        };
    }, [open, file, resetState]);

    // Invalidate in-flight async work and revoke the object URL on unmount.
    useEffect(() => () => {
        genRef.current += 1;
        safeRevokeURL(inputUrlRef.current);
    }, []);

    // ── Loader tick (drives the progress ring re-render) ────────────────
    const now = Date.now();
    const totalTimeMs = processFinish - processStart;
    const spentTimeMs = now - processStart;
    const loadingPercent = totalTimeMs > 0 ? Math.min(spentTimeMs / totalTimeMs, 1) : 0;

    useEffect(() => {
        if (phase !== "processing") return;
        const interval = setInterval(() => setLoadingTick((p) => p + 1), 100);
        return () => clearInterval(interval);
    }, [phase]);

    // ── AI choice → run the pix2art pipeline ────────────────────────────
    // style: "retroart" | "vga" — selects the AI LoRA; undefined when the
    // user declined AI (the pipeline ignores it without AI).
    const processImage = useCallback(async (useAi, style) => {
        if (!file) return;
        const gen = genRef.current;
        setPhase("processing");

        try {
            const result = await processImageFile(
                { file },
                2560,
                2560,
                undefined,
                () => { /* status text is carried by the loader quips */ },
                (name, start, finish) => {
                    if (genRef.current !== gen) return;
                    setProcessStart(start);
                    setProcessFinish(finish);
                },
                useAi,
                "1:1",
                DEFAULT_TRANSFORMATION_STEPS,
                DEFAULT_FIDELITY,
                style
            );

            if (genRef.current !== gen) return;

            let initialSize = "L";
            let initialPreview = null;
            try {
                initialPreview = result.generatePreview(initialSize);
            } catch (e) {
                console.error('[ImageWizard] Error generating initial preview:', e);
                if (result.availableSizes?.length > 0) {
                    initialSize = result.availableSizes[0];
                    initialPreview = result.generatePreview(initialSize);
                }
            }

            if (!initialPreview) throw new Error('Failed to generate preview');

            setProcessorData(result);
            setAvailableSizes(result.availableSizes || []);
            setPreferredSize(initialSize);
            setPreview(initialPreview);
            setPreviewCache({ [initialSize]: initialPreview });
            setProcessStart(0);
            setProcessFinish(0);
            setPhase("adjust");
        } catch (error) {
            console.error('[ImageWizard] Error processing image:', error);
            if (genRef.current !== gen) return;
            setErrorMsg(t("components.image_wizard.the_conversion_failed_please_try_again_later"));
            setPhase("error");
        }
    }, [file]);

    const handleCloseUseAi = useCallback((useAi, style) => {
        processImage(useAi, style);
    }, [processImage]);

    // ── Size selection (identical caching to NewPost) ────────────────────
    const handleSizeChange = useCallback((event) => {
        const newSize = event.target.value;
        setPreferredSize(newSize);

        if (previewCache[newSize]) {
            setPreview(previewCache[newSize]);
            return;
        }

        if (processorData?.generatePreview) {
            try {
                const imageData = processorData.generatePreview(newSize);
                setPreviewCache((prev) => ({ ...prev, [newSize]: imageData }));
                setPreview(imageData);
            } catch (e) {
                console.error('[ImageWizard] Error generating preview:', e);
            }
        }
    }, [previewCache, processorData]);

    // ── Quantization (debounced, applied straight onto the main canvas) ──
    const applyQuantize = useCallback((downscale, colors) => {
        if (!processorData) return;
        if (quantizeTimerRef.current) clearTimeout(quantizeTimerRef.current);

        quantizeTimerRef.current = setTimeout(() => {
            try {
                const quantized = quantizeImageData(
                    { width: processorData.canvasWidth, height: processorData.canvasHeight },
                    processorData.cachedBuffer,
                    downscale,
                    colors
                );
                if (quantized) setQuantizedData(quantized);
            } catch (e) {
                console.error('[ImageWizard] Error applying quantization:', e);
            }
        }, 300);
    }, [processorData]);

    const handleQuantizeDownscaleChange = useCallback((e, value) => {
        setQuantizeDownscale(value);
        applyQuantize(value, quantizeColors);
    }, [applyQuantize, quantizeColors]);

    const handleQuantizeColorsChange = useCallback((e, value) => {
        setQuantizeColors(value);
        applyQuantize(quantizeDownscale, value);
    }, [applyQuantize, quantizeDownscale]);

    const handleCancelQuantize = useCallback(() => {
        if (quantizeTimerRef.current) clearTimeout(quantizeTimerRef.current);
        setQuantizedData(null);
        setQuantizeDownscale(4);
        setQuantizeColors(64);
        if (previewCache[preferredSize]) setPreview(previewCache[preferredSize]);
    }, [previewCache, preferredSize]);

    // ── Render the working image into the preview canvas ────────────────
    useLayoutEffect(() => {
        if (phase !== "adjust" || !canvasRef.current || !dataToUse?.width) return;
        const canvas = canvasRef.current;
        canvas.width = dataToUse.width;
        canvas.height = dataToUse.height;
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, dataToUse.width, dataToUse.height);
        context.putImageData(dataToUse, 0, 0);
    }, [phase, dataToUse]);

    // ── Live weight estimate: encode to WEBP (debounced) ────────────────
    useEffect(() => {
        if (phase !== "adjust" || !dataToUse) return;
        const gen = genRef.current;
        setEncoding(true);

        if (encodeTimerRef.current) clearTimeout(encodeTimerRef.current);
        encodeTimerRef.current = setTimeout(() => {
            JSLoader(() => import("../utils/encodeImage")).then(({ encodeIMG }) => {
                encodeIMG(dataToUse, "WEBP", true).then((b) => {
                    if (genRef.current !== gen) return;
                    const raw = stripDataUriPrefix(b);
                    outRawRef.current = raw;
                    setOutKb(base64ToKb(raw));
                    setEncoding(false);
                }).catch((e) => {
                    console.error('[ImageWizard] Encoding failed:', e);
                    if (genRef.current !== gen) return;
                    setEncoding(false);
                });
            }).catch((e) => {
                console.error('[ImageWizard] Could not load encoder:', e);
                if (genRef.current !== gen) return;
                setEncoding(false);
            });
        }, 250);
    }, [phase, dataToUse]);

    // ── Confirm / cancel ─────────────────────────────────────────────────
    const fitsBudget = outKb !== null && outKb <= maxKb;

    const handleUse = useCallback(() => {
        const raw = outRawRef.current;
        if (!raw) return;
        try {
            const optimized = base64ToFile(raw, "pixagram-avatar.webp");
            if (optimized.size > maxBytes) {
                setErrorMsg(t("components.image_wizard.still_kb_reduce_the_size_or_colors", {
                    size: (optimized.size / 1000).toFixed(1)
                }));
                return;
            }
            if (onComplete) onComplete(optimized);
        } catch (e) {
            console.error('[ImageWizard] Could not build the final file:', e);
            setErrorMsg(t("components.image_wizard.could_not_build_the_final_file_please"));
        }
    }, [onComplete, maxBytes]);

    const handleCancel = useCallback(() => {
        if (onClose) onClose();
    }, [onClose]);

    // ── Step label for the footer ────────────────────────────────────────
    const stepLabel =
        phase === "adjust" ? "Adjust (2/2)" :
            phase === "error" ? "Error" :
                "Convert (1/2)";

    // ── Views ─────────────────────────────────────────────────────────────
    let view = null;
    if (phase === "error") {
        view = (
            <div className={classes.errorContainer}>
                <Typography variant="h6" style={{ color: "#ccc" }}>{t("components.image_wizard.something_went_wrong")}</Typography>
                <Typography variant="body2" style={{ color: "#888" }}>{errorMsg}</Typography>
            </div>
        );
    } else if (phase === "adjust") {
        view = (
            <div style={{ position: "relative" }}>
                <FormControl component="fieldset" className={classes.sizeHeader}>
                    {quantizedData ? (
                        <Fade in timeout={600}>
                            <div className={classes.quantizedMessage}>
                                <span style={{ lineHeight: "32px" }}>{t("words.quantization_applied")}</span>
                                <Button variant="text" onClick={handleCancelQuantize}>{t("words.reset", {TUC: true})}</Button>
                            </div>
                        </Fade>
                    ) : availableSizes.length === 1 ? (
                        <Fade in timeout={600}>
                            <p style={{ lineHeight: "32px" }}>{t("components.image_wizard.already_pixel_art_tune_the_weight_below")}</p>
                        </Fade>
                    ) : (
                        <RadioGroup
                            row
                            aria-label="size"
                            name="SIZE"
                            color="primary"
                            value={preferredSize}
                            onChange={handleSizeChange}
                        >
                            {availableSizes.map((size, index) => (
                                <Fade key={size} in timeout={200 * (index + 1)}>
                                    <FormControlLabel value={size} control={<Radio />} label={size} />
                                </Fade>
                            ))}
                        </RadioGroup>
                    )}
                </FormControl>

                <div className="pixelated" style={{ width: "100%", textAlign: "center" }}>
                    <canvas ref={canvasRef} className={classes.previewCanvas} />
                </div>

                <div className={classes.sliderContainer}>
                    <Box>
                        <Typography className={classes.sliderLabel} gutterBottom>{t("words.downscale_ratio")}</Typography>
                        <Slider
                            value={quantizeDownscale}
                            onChange={handleQuantizeDownscaleChange}
                            min={1}
                            max={32}
                            step={1}
                            marks={[
                                { value: 1, label: '1x' },
                                { value: 4, label: '4x' },
                                { value: 8, label: '8x' },
                                { value: 12, label: '12x' },
                                { value: 16, label: '16x' },
                                { value: 24, label: '24x' },
                                { value: 32, label: '32x' }
                            ]}
                            valueLabelDisplay="auto"
                        />
                    </Box>

                    <Box>
                        <Typography className={classes.sliderLabel} gutterBottom>{t("words.number_of_colors")}</Typography>
                        <Slider
                            value={quantizeColors}
                            onChange={handleQuantizeColorsChange}
                            min={2}
                            max={128}
                            step={1}
                            marks={[
                                { value: 2, label: '2' },
                                { value: 16, label: '16' },
                                { value: 32, label: '32' },
                                { value: 64, label: '64' },
                                { value: 96, label: '96' },
                                { value: 128, label: '128' }
                            ]}
                            valueLabelDisplay="auto"
                        />
                    </Box>
                </div>

                {errorMsg && (
                    <Typography variant="caption" style={{ color: "#888", display: "block", textAlign: "center", marginTop: 8 }}>
                        {errorMsg}
                    </Typography>
                )}
            </div>
        );
    } else {
        // idle / ask / processing — blurred input behind the loader / AI dialog
        view = (
            <div className={classes.stage}>
                {inputFileUrl && (
                    <Fade in timeout={300}>
                        <img src={inputFileUrl} className={classes.inputImage + " pixelated"} alt={t("words.input_image")} />
                    </Fade>
                )}
                {phase === "processing" && (
                    <ConversionLoader classes={classes} loadingPercent={loadingPercent} />
                )}
            </div>
        );
    }

    return (
        <React.Fragment>
            {/* Main Dialog */}
            <Dialog
                className={classes.dialog}
                open={open}
                maxWidth={false}
                fullWidth={false}
                disablePortal={false}
                onClose={handleCancel}
                keepMounted={false}
            >
                <DialogContent style={{ position: "relative" }}>
                    {view}
                </DialogContent>
                <DialogActions style={{
                    backgroundColor: "#171717",
                    borderRadius: "32px",
                    textAlign: "right",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 24px"
                }}>
                    <Box style={{ textAlign: "left" }}>
                        <Typography variant="body2" style={{ textTransform: "uppercase", marginBottom: "8px", fontWeight: 600, marginTop: 0, fontSize: "1rem", color: "#ccc", lineHeight: 1 }}>
                            {stepLabel}
                        </Typography>
                        <Typography
                            variant="caption"
                            style={{
                                color: phase === "adjust" && !encoding && outKb !== null ? (fitsBudget ? "#ccc" : "#888") : "#999",
                                display: "block",
                                fontSize: "0.875rem",
                                lineHeight: 1.125,
                                fontVariantNumeric: "tabular-nums"
                            }}
                        >
                            {phase === "adjust"
                                ? encoding
                                    ? "Weighing…"
                                    : outKb !== null
                                        ? `≈ ${outKb.toFixed(2)} kB — ${fitsBudget ? t("components.image_wizard.fits_the_kb_limit", {
                                maxKb: maxKb
                            }) : t("components.image_wizard.over_the_kb_limit_reduce_size_or", {
                                maxKb: maxKb
                            })}`
                                        : t("components.image_wizard.image_wizard_kb_budget", {
                                maxKb: maxKb
                            })
                                : t("components.image_wizard.image_wizard_kb_budget", {
                                maxKb: maxKb
                            })}
                        </Typography>
                    </Box>
                    <Box>
                        <Button variant="text" color="primary" onClick={handleCancel}>
                            {t("words.cancel")}
                        </Button>
                        <Button
                            size="large"
                            style={{ borderRadius: "32px" }}
                            variant="contained"
                            color="primary"
                            disabled={phase !== "adjust" || encoding || !fitsBudget}
                            onClick={handleUse}
                        >
                            {t("components.image_wizard.use_picture")}
                        </Button>
                    </Box>
                </DialogActions>
            </Dialog>
            {/* AI Dialog — same question, same look as NewPost */}
            <Dialog
                PaperProps={{ classes: { root: classes.whiteDialog } }}
                open={open && phase === "ask"}
                maxWidth="xs"
                disablePortal={false}
                onClose={() => handleCloseUseAi(false)}
                keepMounted={false}
            >
                <DialogContent>
                    <Typography style={{ marginTop: 8, marginBottom: 24 }} component="h2" variant="h6">
                        {t("words.transform_your_picture_with_ai")}
                    </Typography>
                    <Typography variant="body2" color="textPrimary" component="p">
                        <T k="components.image_wizard.your_picture_must_be_pixel_art_under" vars={{ maxKb }} />
                    </Typography>
                    <Box style={{ display: "flex", gap: "12px", marginTop: 24, marginBottom: 8 }}>
                        <Button
                            variant="contained"
                            color="primary"
                            style={{ flexGrow: 1 }}
                            onClick={() => handleCloseUseAi(true, "vga")}
                        >
                            {t("words.vga_style")}
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            style={{ flexGrow: 1 }}
                            onClick={() => handleCloseUseAi(true, "retroart")}
                        >
                            {t("words.retro_art")}
                        </Button>
                    </Box>
                </DialogContent>
                <DialogActions style={{ textAlign: "right" }}>
                    <Button variant="text" color="primary" autoFocus onClick={() => handleCloseUseAi(false)}>
                        {t("words.no_i_don_t_want")}
                    </Button>
                </DialogActions>
            </Dialog>
        </React.Fragment>
    );
}

export default withStyles(styles)(ImageWizard);