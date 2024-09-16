import * as React from "preact/compat";
import { useState, useRef, useCallback, useEffect, useMemo } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import LockOutlined from "@material-ui/icons/LockOutlined";
import LockOpenRounded from "@material-ui/icons/LockOpenRounded";
import CheckRounded from "@material-ui/icons/CheckRounded";
import CircularProgress from "@material-ui/core/CircularProgress";

const getWindowDimensions = () => {
    const documentElement = document.documentElement;
    const body = document.body || document.getElementsByTagName('body')[0];
    return {
        width: window.innerWidth || documentElement.clientWidth || body.clientWidth,
        height: window.innerHeight || documentElement.clientHeight || body.clientHeight
    };
};

const W = Math.min(360, getWindowDimensions().width - 112);

const styles = theme => ({
    wrapper: {
        position: "relative",
        backgroundColor: "#ddd",
        height: 48,
        borderRadius: 24,
        margin: "16px auto",
        display: "flex",
        contain: "size style layout",
        boxSizing: "border-box",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none"
    },
    slider: {
        position: "absolute",
        left: 0,
        backgroundColor: "#111",
        width: 64,
        height: 64,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        zIndex: 2,
        userSelect: "none",
        touchAction: "none",
        boxShadow: "0px 0px 2px 0px #00000033, 0px 0px 6px 0px #0000006e, 0px 0px 9px 0px #000000ba",
        willChange: "transform",
    },
    unlockedSlider: {
        width: "100%",
        height: "100%",
        left: 0,
        borderRadius: 24,
        backgroundColor: "#333",
        boxShadow: "none",
    },
    icon: {
        color: "#ffffff",
        fontSize: 32,
        pointerEvents: "none",
        userSelect: "none",
        transition: "opacity 0.2s ease, transform 0.2s ease",
    },
    textContainer: {
        position: "absolute",
        borderRadius: 24,
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
        overflow: "hidden",
    },
    text: {
        color: "#777",
        fontSize: 14,
        textTransform: "uppercase",
        userSelect: "none",
        touchAction: "none",
        fontWeight: 500,
        letterSpacing: "0.5px",
        background: "linear-gradient(90deg, #777 0%, #999 25%, #bbb 50%, #999 75%, #777 100%)",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        animation: "$wave 3s ease-in-out infinite",
    },
    textMask: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: "#ddd",
        zIndex: 1,
        pointerEvents: "none",
    },
    "@keyframes wave": {
        "0%": {
            backgroundPosition: "200% 0",
        },
        "100%": {
            backgroundPosition: "-200% 0",
        },
    },
});

const SwipeSend = ({ classes, unlocked: initialUnlocked = false, completed: initialCompleted = 0, onUnlock, onLock }) => {
    const [unlocked, setUnlocked] = useState(initialUnlocked);
    const [completed, setCompleted] = useState(initialCompleted);
    const [left, setLeft] = useState(-12);
    const [maskWidth, setMaskWidth] = useState(0);
    const [iconState, setIconState] = useState('locked'); // 'locked', 'unlocking', 'unlocked'

    const sliderRef = useRef(null);
    const wrapperRef = useRef(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const animationFrame = useRef(null);
    const width = useRef(W);
    // Live position ref so handleUp never reads stale state
    const leftRef = useRef(-12);
    const unlockedRef = useRef(initialUnlocked);

    const slideMax = useMemo(() => width.current - 64 + 12, []);
    const iconChangeThreshold = useMemo(() => slideMax * 0.333, [slideMax]);
    const confirmThreshold = useMemo(() => slideMax * 0.666, [slideMax]);

    useEffect(() => {
        setCompleted(initialCompleted);
        setUnlocked(initialUnlocked);
        unlockedRef.current = initialUnlocked;
    }, [initialCompleted, initialUnlocked]);

    const updateSliderPosition = useCallback((newLeft) => {
        if (sliderRef.current && !unlockedRef.current) {
            sliderRef.current.style.transform = `translateX(${Math.max(-12, newLeft)}px)`;
        }
    }, []);

    const commitUnlock = useCallback(() => {
        isDragging.current = false;
        unlockedRef.current = true;
        leftRef.current = width.current;
        setUnlocked(true);
        setLeft(width.current);
        setMaskWidth(width.current);
        setIconState('unlocked');
        if (onUnlock) {
            setTimeout(() => onUnlock(), 100);
        }
    }, [onUnlock]);

    const resetSlider = useCallback(() => {
        leftRef.current = -12;
        setLeft(-12);
        setMaskWidth(0);
        setIconState('locked');
        updateSliderPosition(-12);
    }, [updateSliderPosition]);

    const handleDown = useCallback((e) => {
        if (unlockedRef.current) return;
        e.preventDefault();
        const clientX = e.clientX || (e.touches && e.touches[0].pageX);
        isDragging.current = true;
        startX.current = clientX;
    }, []);

    const handleMove = useCallback((e) => {
        if (!isDragging.current || unlockedRef.current) return;

        const clientX = e.clientX || (e.touches && e.touches[0].pageX);
        const delta = clientX - startX.current;
        const newLeft = Math.min(Math.max(-12, delta - 12), slideMax);

        if (animationFrame.current) {
            cancelAnimationFrame(animationFrame.current);
        }

        animationFrame.current = requestAnimationFrame(() => {
            // Update the live ref immediately
            leftRef.current = newLeft;

            updateSliderPosition(newLeft);
            setLeft(newLeft);

            // Update mask width to hide text behind slider
            const maskW = Math.max(0, newLeft + 64 + 12);
            setMaskWidth(maskW);

            // Update icon state based on progress
            if (newLeft >= iconChangeThreshold) {
                setIconState('unlocking');
            } else {
                setIconState('locked');
            }

            // Check if reached confirm threshold — commit unlock directly
            if (newLeft >= confirmThreshold) {
                commitUnlock();
            }
        });
    }, [slideMax, iconChangeThreshold, confirmThreshold, updateSliderPosition, commitUnlock]);

    const handleUp = useCallback(() => {
        if (!isDragging.current) return;
        isDragging.current = false;

        if (animationFrame.current) {
            cancelAnimationFrame(animationFrame.current);
            animationFrame.current = null;
        }

        // Read live ref, not stale state closure
        if (leftRef.current >= confirmThreshold) {
            commitUnlock();
        } else {
            resetSlider();
        }
    }, [confirmThreshold, commitUnlock, resetSlider]);

    const handleReset = useCallback(() => {
        if (!unlockedRef.current) return;

        unlockedRef.current = false;
        setUnlocked(false);
        resetSlider();

        if (onLock) {
            onLock();
        }
    }, [resetSlider, onLock]);

    // Attach move/up listeners to document so dragging works even when pointer
    // leaves the slider or the wrapper entirely.
    useEffect(() => {
        const onMouseMove = (e) => handleMove(e);
        const onMouseUp = (e) => handleUp(e);
        const onTouchMove = (e) => handleMove(e);
        const onTouchEnd = (e) => handleUp(e);

        document.addEventListener("mousemove", onMouseMove, { passive: false });
        document.addEventListener("mouseup", onMouseUp);
        document.addEventListener("touchmove", onTouchMove, { passive: false });
        document.addEventListener("touchend", onTouchEnd);

        return () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.removeEventListener("touchmove", onTouchMove);
            document.removeEventListener("touchend", onTouchEnd);

            if (animationFrame.current) {
                cancelAnimationFrame(animationFrame.current);
            }
        };
    }, [handleMove, handleUp]);

    const getIcon = () => {
        if (completed > 0) {
            return completed === 1 ? (
                <CircularProgress
                    style={{ transform: "scale(0.75)" }}
                    variant="indeterminate"
                    className={classes.icon}
                />
            ) : (
                <CheckRounded className={classes.icon} />
            );
        }

        switch (iconState) {
            case 'unlocking':
                return <LockOpenRounded className={classes.icon} />;
            case 'unlocked':
                return <CheckRounded className={classes.icon} />;
            case 'locked':
            default:
                return <LockOutlined className={classes.icon} />;
        }
    };

    const sliderStyle = {
        transition: unlocked
            ? "width 300ms cubic-bezier(0.4, 0, 0.2, 1), height 300ms cubic-bezier(0.4, 0, 0.2, 1), left 300ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1), background-color 300ms cubic-bezier(0.4, 0, 0.2, 1)"
            : isDragging.current
                ? "none"
                : "width 300ms cubic-bezier(0.4, 0, 0.2, 1), height 300ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 300ms cubic-bezier(0.4, 0, 0.2, 1), background-color 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        left: unlocked ? "-100%" : "0%",
        willChange: unlocked ? "inherit" : "transform",
        transform: unlocked ? `translateX(${width.current}px)` : `translateX(${left}px)`,
    };

    return (
        <div
            className={classes.wrapper}
            style={{ width: width.current }}
            onClick={handleReset}
            ref={wrapperRef}
        >
            <div className={classes.textContainer}>
                <span className={classes.text}>
                    Slide to Confirm >>>
                </span>
                <div
                    className={classes.textMask}
                    style={{ width: maskWidth }}
                />
            </div>
            <div
                ref={sliderRef}
                className={`${classes.slider}${unlocked ? ' ' + classes.unlockedSlider : ''}`}
                onMouseDown={handleDown}
                onTouchStart={handleDown}
                style={sliderStyle}
            >
                {getIcon()}
            </div>
        </div>
    );
};

export default withStyles(styles)(SwipeSend);