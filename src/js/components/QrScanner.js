import * as React from "preact/compat";
import { useState, useEffect, useRef, memo, useCallback } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import Box from "@material-ui/core/Box";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Fade from "@material-ui/core/Fade";
import CircularProgress from "@material-ui/core/CircularProgress";

import CloseIcon from "@material-ui/icons/Close";
import FlashOnIcon from "@material-ui/icons/FlashOn";
import FlashOffIcon from "@material-ui/icons/FlashOff";
import VideocamIcon from "@material-ui/icons/Videocam";

import JSLoader from "../utils/JSLoader";

import { t } from "../utils/text";

/**
 * Fraction of the frame's short edge that we both *search* and *draw a reticle
 * around*. One constant, two consumers — otherwise the reticle is decoration
 * that lies about where the scanner is actually looking.
 *
 * This lines up because the viewfinder box is square and the video is
 * `object-fit: cover`: cover makes the video's short edge exactly fill a square
 * box, and the ROI is a fraction of that same short edge. Change the box's
 * aspect ratio and the two drift apart.
 */
const ROI_RATIO = 0.75;

const styles = (theme) => ({
    dialog: {
        "& .MuiDialogContent-root": {
            padding: "8px 24px 0px 24px",
        },
    },
    viewfinder: {
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",
        backgroundColor: "#111",
        borderRadius: "21px",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        contain: "style layout",
        // Consumed by the reticle SVG so a tracking-state change repaints in CSS
        // instead of re-rendering the mask.
        "--reticle-stroke": "#ffffff",
    },
    // The video *is* the display surface — no canvas, no per-frame bitmap copy.
    // The browser composites it, which costs us nothing.
    video: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
    },
    // Same box, same object-fit, sized to the analysis buffer — so the quad
    // coordinates wasm reports need no transform.
    tracker: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        pointerEvents: "none",
        zIndex: 5,
    },
    hint: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: theme.spacing(2),
        textAlign: "center",
        color: "#fff",
        textShadow: "0 1px 3px rgba(0,0,0,0.8)",
        pointerEvents: "none",
        zIndex: 20,
        padding: `0 ${theme.spacing(3)}px`,
    },
    fallback: {
        width: "100%",
        aspectRatio: "1 / 1",
        borderRadius: "21px",
        border: "2px dashed #555",
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(2),
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: theme.spacing(3),
    },
    controlsRow: {
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(1),
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: theme.spacing(2),
    },
    selectDropdown: {
        "& .MuiOutlinedInput-root": {
            borderRadius: "12px",
            backgroundColor: "rgba(0,0,0,0.05)",
            color: "#000000",
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#666" },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#000000" },
        },
        "& .MuiSelect-icon": { color: "#333" },
        "& .MuiInputLabel-root": { color: "#333" },
        "& .MuiInputLabel-root.Mui-focused": { color: "#000" },
    },
    flashBtn: {
        backgroundColor: "rgba(0,0,0,0.05)",
        color: "#000",
        padding: "12px",
        "&:hover": { backgroundColor: "rgba(0,0,0,0.15)" },
    },
});

/**
 * Reticle: a dimming mask with a hole, plus four corner brackets. Memoised on
 * geometry only — the stroke colour rides in on a CSS custom property so
 * tracking-state changes never re-render this.
 */
const Reticle = memo(({ width, height, maskSize, cornerLength = 64, cornerRadius = 24, lineWidth = 12 }) => {
    const r = Math.min(cornerRadius, cornerLength);
    const len = Math.min(cornerLength, maskSize / 2);

    const left = width / 2 - maskSize / 2;
    const top = height / 2 - maskSize / 2;
    const right = width / 2 + maskSize / 2;
    const bottom = height / 2 + maskSize / 2;

    const d = [
        `M ${left} ${top + len} L ${left} ${top + r} Q ${left} ${top} ${left + r} ${top} L ${left + len} ${top}`,
        `M ${right - len} ${top} L ${right - r} ${top} Q ${right} ${top} ${right} ${top + r} L ${right} ${top + len}`,
        `M ${right} ${bottom - len} L ${right} ${bottom - r} Q ${right} ${bottom} ${right - r} ${bottom} L ${right - len} ${bottom}`,
        `M ${left + len} ${bottom} L ${left + r} ${bottom} Q ${left} ${bottom} ${left} ${bottom - r} L ${left} ${bottom - len}`,
    ].join(" ");

    const maskId = `reticle-${width}x${height}`;

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 10 }}
            aria-hidden="true"
        >
            <defs>
                <mask id={maskId}>
                    <rect x="0" y="0" width={width} height={height} fill="white" />
                    <rect x={left} y={top} width={maskSize} height={maskSize} rx={r} ry={r} fill="black" />
                </mask>
            </defs>
            <rect x="0" y="0" width={width} height={height} fill="rgba(0,0,0,0.55)" mask={`url(#${maskId})`} />
            <path
                d={d}
                fill="none"
                stroke="var(--reticle-stroke)"
                strokeWidth={lineWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
});

const RETICLE_COLORS = {
    idle: "#ffffff",
    searching: "#ffffff", // nothing found for a while; hint text changes instead
    tracking: "#ffd54f", // code seen, payload not readable yet
    hit: "#3ddc84",
};

const ScannerView = ({ classes, isLoading, trackState, hint, videoRef, trackerRef }) => {
    const boxRef = useRef(null);
    const [size, setSize] = useState({ width: 320, height: 320 });

    useEffect(() => {
        const el = boxRef.current;
        if (!el) return;

        const measure = () => {
            const { offsetWidth, offsetHeight } = el;
            if (offsetWidth > 0 && offsetHeight > 0) {
                setSize((prev) =>
                    prev.width === offsetWidth && prev.height === offsetHeight
                        ? prev
                        : { width: offsetWidth, height: offsetHeight },
                );
            }
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            className={classes.viewfinder}
            ref={boxRef}
            style={{ "--reticle-stroke": RETICLE_COLORS[trackState] || RETICLE_COLORS.idle }}
        >
            <video ref={videoRef} className={classes.video} playsInline muted />
            <canvas ref={trackerRef} className={classes.tracker} />

            {isLoading && (
                <Fade in timeout={400}>
                    <CircularProgress style={{ color: "#fff", position: "absolute", zIndex: 30 }} />
                </Fade>
            )}

            {!isLoading && (
                <Reticle
                    width={size.width}
                    height={size.height}
                    maskSize={Math.min(size.width, size.height) * ROI_RATIO}
                />
            )}

            {!isLoading && hint && (
                <Typography variant="body2" className={classes.hint}>
                    {hint}
                </Typography>
            )}
        </div>
    );
};

const QRScannerDialog = ({ classes, open, onClose, onScanResult }) => {
    const [cameras, setCameras] = useState([]);
    const [selectedCamera, setSelectedCamera] = useState("");
    const [isFlashOn, setIsFlashOn] = useState(false);
    const [hasFlash, setHasFlash] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [errorKind, setErrorKind] = useState(null); // null | "blocked" | "missing" | "failed"
    const [trackState, setTrackState] = useState("idle");

    const videoRef = useRef(null);
    const trackerRef = useRef(null);
    const scannerRef = useRef(null);
    const sessionRef = useRef(0);
    const hasScannedRef = useRef(false);

    // Latest-callback ref. The parent almost certainly passes inline arrow
    // functions for onScanResult/onClose, so having them in the effect's
    // dependency list tore the camera down and reopened it on *every* parent
    // render — permission flicker, black frames, wasted getUserMedia calls.
    // The effect now depends on `open` alone.
    const cbRef = useRef({ onScanResult, onClose });
    cbRef.current.onScanResult = onScanResult;
    cbRef.current.onClose = onClose;

    const teardown = useCallback(() => {
        const scanner = scannerRef.current;
        scannerRef.current = null;
        if (!scanner) return;
        try {
            scanner.destroy();
        } catch (e) {
            console.warn("Scanner teardown:", e);
        }
    }, []);

    useEffect(() => {
        if (!open) {
            sessionRef.current++;
            teardown();
            setCameras([]);
            setSelectedCamera("");
            setIsFlashOn(false);
            setHasFlash(false);
            setIsLoading(true);
            setErrorKind(null);
            setTrackState("idle");
            hasScannedRef.current = false;
            return;
        }

        const session = ++sessionRef.current;
        const alive = () => session === sessionRef.current;
        hasScannedRef.current = false;

        (async () => {
            setIsLoading(true);
            setErrorKind(null);

            // The engine is loaded on demand so the dialog paints immediately.
            // JSLoader memoises the import, so reopening skips the download.
            let QrScanner;
            try {
                ({ QrScanner } = await JSLoader(() => import("../utils/qrscanner")));
            } catch (err) {
                console.error("Scanner load failed:", err);
                if (alive()) {
                    setErrorKind("failed");
                    setIsLoading(false);
                }
                return;
            }
            if (!alive()) return;

            // The video element must exist before open(); it's rendered
            // unconditionally above, so a ref check is enough — no setTimeout.
            if (!videoRef.current) {
                if (alive()) {
                    setErrorKind("failed");
                    setIsLoading(false);
                }
                return;
            }

            const scanner = new QrScanner({ roi: ROI_RATIO });
            scanner.attach({ video: videoRef.current, overlay: trackerRef.current });

            scanner.onResult = (text) => {
                if (!alive() || hasScannedRef.current) return;
                hasScannedRef.current = true;
                setTrackState("hit");
                if (navigator.vibrate) navigator.vibrate(200);
                scanner.close();
                cbRef.current.onScanResult?.(text);
                cbRef.current.onClose?.();
            };

            scanner.onTrack = ({ status, escalated }) => {
                if (!alive() || hasScannedRef.current) return;
                setTrackState(status === 1 || status === 2 ? "tracking" : escalated ? "searching" : "idle");
            };

            scannerRef.current = scanner;

            try {
                await scanner.open();
            } catch (err) {
                console.error("Camera open failed:", err);
                if (!alive()) return;
                teardown();
                setErrorKind(errorKindFor(err));
                setIsLoading(false);
                return;
            }

            if (!alive()) {
                teardown();
                return;
            }

            setIsLoading(false);
            setHasFlash(scanner.torchSupported);

            // Labels are only populated once permission has been granted, so
            // enumerate after open(), not before.
            const list = await QrScanner.listCameras();
            if (!alive()) return;
            setCameras(list);
            setSelectedCamera(scanner.currentDeviceId || list[list.length - 1]?.id || "");
        })();

        return () => {
            sessionRef.current++;
            teardown();
        };
    }, [open, teardown]);

    const handleClose = useCallback(() => {
        sessionRef.current++;
        teardown();
        cbRef.current.onClose?.();
    }, [teardown]);

    const handleCameraChange = useCallback(async (event) => {
        const deviceId = event.target.value;
        setSelectedCamera(deviceId);

        const scanner = scannerRef.current;
        if (!scanner) return;

        setIsLoading(true);
        setIsFlashOn(false);
        try {
            await scanner.open({ deviceId });
            setHasFlash(scanner.torchSupported);
        } catch (err) {
            console.error("Camera switch failed:", err);
            setErrorKind(errorKindFor(err));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const toggleFlash = useCallback(async () => {
        const scanner = scannerRef.current;
        if (!scanner) return;
        const next = await scanner.setTorch(!isFlashOn);
        setIsFlashOn(next);
    }, [isFlashOn]);

    const hint =
        trackState === "tracking"
            ? t("components.qr_scanner.hold_steady")
            : trackState === "searching"
                ? t("components.qr_scanner.move_closer")
                : t("components.qr_scanner.point_at_code");

    return (
        <Dialog
            className={classes.dialog}
            keepMounted={true}
            open={open}
            maxWidth={false}
            onClose={handleClose}
            PaperProps={{
                style: {
                    width: "min(calc(100% - 32px), 800px)",
                    maxWidth: "none",
                    backgroundColor: "#ffffff",
                    color: "#000000",
                },
            }}
        >
            <DialogContent style={{ position: "relative", overflow: "hidden" }}>
                <IconButton
                    onClick={handleClose}
                    aria-label={t("words.close")}
                    style={{ position: "absolute", right: 8, top: 8, color: "#000000", zIndex: 100 }}
                >
                    <CloseIcon />
                </IconButton>

                <Typography style={{ marginTop: 8, marginBottom: 16 }} component="h2" variant="h6">
                    {t("words.scan_qr_code")}
                </Typography>

                {errorKind ? (
                    <Box className={classes.fallback}>
                        <VideocamIcon style={{ fontSize: 48, color: "#000000" }} />
                        <Typography variant="h6">
                            {errorKind === "missing"
                                ? t("components.qr_scanner.no_camera_found")
                                : t("components.qr_scanner.camera_blocked")}
                        </Typography>
                        <Typography variant="body2" style={{ color: "#101010" }}>
                            {errorKind === "missing"
                                ? t("components.qr_scanner.connect_a_camera")
                                : t("components.qr_scanner.please_check_browser_permissions")}
                        </Typography>
                    </Box>
                ) : (
                    <ScannerView
                        classes={classes}
                        isLoading={isLoading}
                        trackState={trackState}
                        hint={hint}
                        videoRef={videoRef}
                        trackerRef={trackerRef}
                    />
                )}

                <Box className={classes.controlsRow}>
                    <FormControl
                        variant="outlined"
                        className={classes.selectDropdown}
                        size="small"
                        style={{ flexGrow: 1 }}
                    >
                        <InputLabel>{t("components.qr_scanner.camera")}</InputLabel>
                        <Select
                            value={selectedCamera}
                            onChange={handleCameraChange}
                            label={t("components.qr_scanner.camera")}
                            disabled={cameras.length < 2}
                            MenuProps={{
                                PaperProps: { style: { backgroundColor: "#eee", color: "#202020" } },
                            }}
                        >
                            {cameras.map((cam, idx) => (
                                <MenuItem key={cam.id || idx} value={cam.id}>
                                    {cam.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <IconButton
                        className={classes.flashBtn}
                        onClick={toggleFlash}
                        disabled={isLoading || !!errorKind || !hasFlash}
                        aria-label={t("components.qr_scanner.toggle_flash")}
                        aria-pressed={isFlashOn}
                    >
                        {isFlashOn ? (
                            <FlashOnIcon style={{ color: "#000000" }} />
                        ) : (
                            <FlashOffIcon style={{ color: "#202020" }} />
                        )}
                    </IconButton>
                </Box>
            </DialogContent>
        </Dialog>
    );
};

/** "Blocked" and "no camera at all" need different instructions. */
function errorKindFor(err) {
    switch (err?.name) {
        case "NotAllowedError":
        case "SecurityError":
            return "blocked";
        case "NotFoundError":
        case "OverconstrainedError":
            return "missing";
        default:
            return "failed";
    }
}

export default withStyles(styles)(QRScannerDialog);