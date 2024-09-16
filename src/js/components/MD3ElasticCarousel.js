import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
/**
 * MD3 Elastic Carousel
 *
 * True Material Design 3 carousel with:
 * - ONE main card at full width
 * - All other cards have elastic widths (20% - 100%)
 * - Continuous interpolation during scroll/drag
 * - Smooth momentum physics
 */

const CONFIG = {
    CARD_MAX_WIDTH: 320,      // Full width for center card
    CARD_MIN_WIDTH: 64,       // Minimum width (~20%)
    CARD_HEIGHT: 400,
    CARD_GAP: 12,

    DRAG_THRESHOLD: 5,
    MOMENTUM_MULTIPLIER: 80,  // Reduced for less reactive feel
    VELOCITY_DAMPING: 0.92,   // Damping factor for velocity calculation
};

const styles = theme => ({
    wrapper: {
        position: 'relative',
        width: '100%',
        overflow: 'hidden',
        padding: '24px 0',
        touchAction: 'pan-y',
    },

    track: {
        display: 'flex',
        alignItems: 'center',
        gap: `${CONFIG.CARD_GAP}px`,
        cursor: 'grab',
        userSelect: 'none',
        willChange: 'transform',
        '&:active': {
            cursor: 'grabbing',
        },
    },

    spacer: {
        flexShrink: 0,
    },

    card: {
        flexShrink: 0,
        borderRadius: '24px',
        overflow: 'hidden',
        background: 'linear-gradient(145deg, #1a1a1a 0%, #141414 100%)',
        position: 'relative',
        height: `${CONFIG.CARD_HEIGHT}px`,
        border: '1px solid rgba(255,255,255,0.04)',
        cursor: 'pointer',
    },

    // === COLLAPSED CONTENT (narrow cards) ===
    collapsedContent: {
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    collapsedImage: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        // Brightness is set dynamically inline based on card width
    },
    collapsedGradient: {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 100%)',
    },
    verticalLabel: {
        position: 'relative',
        zIndex: 2,
        writingMode: 'vertical-rl',
        textOrientation: 'mixed',
        transform: 'rotate(180deg)',
        fontSize: '16px',
        fontFamily: '"Industry Book", "Industry", sans-serif',
        fontWeight: '500',
        color: '#ffffff',
        letterSpacing: '3px',
        textTransform: 'uppercase',
        textShadow: '0 2px 12px rgba(0,0,0,0.9)',
        padding: '20px 0',
        maxHeight: 'calc(100% - 40px)',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
    },

    // === EXPANDED CONTENT (main card) ===
    expandedContent: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box',
        position: 'absolute',
        inset: 0,
        // Opacity controlled inline based on expansion progress
    },
    avatar: {
        width: '140px',
        height: '140px',
        borderRadius: '50%',
        objectFit: 'cover',
        backgroundColor: '#0a0a0a',
        marginBottom: '20px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        border: '3px solid rgba(255,255,255,0.1)',
    },
    name: {
        fontSize: '20px',
        fontFamily: '"Industry Book", "Industry", sans-serif',
        fontWeight: '500',
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: '8px',
        letterSpacing: '-0.02em',
    },
    role: {
        fontSize: '14px',
        fontFamily: '"Normative Pro", "Industry Book", "Normative", sans-serif',
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        marginBottom: '4px',
        fontWeight: '400',
    },
    country: {
        fontSize: '12px',
        fontFamily: '"Normative Pro", "Industry Book", "Normative", sans-serif',
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        marginBottom: '20px',
        fontWeight: '400',
    },
    actionButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        backgroundColor: 'transparent',
        color: 'rgba(255,255,255,0.7)',
        borderRadius: '8px',
        textDecoration: 'none',
        fontSize: '13px',
        fontFamily: '"Normative Pro", "Industry Book", "Normative", sans-serif',
        fontWeight: '500',
        transition: 'color 250ms ease, background-color 150ms ease',
        border: 'none',
        position: 'relative',
        overflow: 'hidden',
        // Ripple effect via pseudo-element
        '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(255,255,255,0)',
            borderRadius: '8px',
            transition: 'background-color 250ms ease',
        },
        '&:hover': {
            color: '#ffffff',
            '&::before': {
                backgroundColor: 'rgba(255,255,255,0.08)',
            },
        },
        '&:active': {
            '&::before': {
                backgroundColor: 'rgba(255,255,255,0.15)',
            },
        },
    },
    actionButtonContent: {
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },

    // === NAVIGATION ===
    navButton: {
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: '#101010',
        border: 'none',
        color: '#ffffff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 300ms ease',
        zIndex: 10,
        '&:hover:not(:disabled)': {
            backgroundColor: '#191919',
            transform: 'translateY(-50%) scale(1.08)',
        },
        '&:disabled': {
            opacity: 0.25,
            cursor: 'not-allowed',
        },
    },
    navButtonLeft: {
        left: '20px',
    },
    navButtonRight: {
        right: '20px',
    },
    navIcon: {
        width: '24px',
        height: '24px',
        fill: 'currentColor',
    },

    // === PAGINATION ===
    pagination: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px',
        marginTop: '24px',
    },
    pageIndicator: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: '#101010',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        transition: 'all 350ms cubic-bezier(0.23, 1, 0.32, 1)',
        '&:hover': {
            backgroundColor: '#191919',
            transform: 'scale(1.2)',
        },
    },
    pageIndicatorActive: {
        width: '28px',
        borderRadius: '4px',
        backgroundColor: '#191919',
    },
});

class MD3ElasticCarousel extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            scrollOffset: 0,
            activeIndex: props.initialIndex || 0,
            cardWidths: [],
            hasDragged: false,
        };

        this.trackRef = React.createRef();
        this.wrapperRef = React.createRef();
        this.cardsRef = [];

        // Drag state
        this.isDragging = false;
        this.startX = 0;
        this.lastX = 0;
        this.lastTime = 0;
        this.velocity = 0;
        this.animationFrame = null;
        this.currentScrollOffset = 0;
    }

    componentDidMount() {
        this.initializeCardWidths();

        const wrapper = this.wrapperRef.current;
        if (wrapper) {
            wrapper.addEventListener('touchstart', this.handleTouchStart, { passive: true });
            wrapper.addEventListener('touchmove', this.handleTouchMove, { passive: false });
            wrapper.addEventListener('touchend', this.handleTouchEnd, { passive: true });
        }

        window.addEventListener('resize', this.handleResize);

        // Initial snap to first card
        requestAnimationFrame(() => {
            this.snapToCard(this.state.activeIndex, false);
        });
    }

    componentWillUnmount() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        const wrapper = this.wrapperRef.current;
        if (wrapper) {
            wrapper.removeEventListener('touchstart', this.handleTouchStart);
            wrapper.removeEventListener('touchmove', this.handleTouchMove);
            wrapper.removeEventListener('touchend', this.handleTouchEnd);
        }

        window.removeEventListener('resize', this.handleResize);
    }

    handleResize = () => {
        this.initializeCardWidths();
        this.snapToCard(this.state.activeIndex, false);
    };

    initializeCardWidths = () => {
        const { items } = this.props;
        const cardWidths = items.map(() => CONFIG.CARD_MIN_WIDTH);
        this.setState({ cardWidths });
    };

    getViewportCenter = () => {
        const wrapper = this.wrapperRef.current;
        if (!wrapper) return 0;
        return wrapper.offsetWidth / 2;
    };

    getSpacerWidth = () => {
        return this.getViewportCenter() - CONFIG.CARD_MAX_WIDTH / 2;
    };

    // Get card width based on index distance from active card
    // Simple, predictable values ensure symmetry
    getWidthForIndexDistance = (indexDistance) => {
        switch (indexDistance) {
            case 0: return CONFIG.CARD_MAX_WIDTH;           // 320px - Active card
            case 1: return CONFIG.CARD_MAX_WIDTH * 0.5;     // 160px - Adjacent
            case 2: return CONFIG.CARD_MAX_WIDTH * 0.3;     // 96px - Two away
            default: return CONFIG.CARD_MIN_WIDTH;          // 64px - Far cards
        }
    };

    // Get card opacity based on its width (more expanded = more opaque)
    getCardOpacity = (width) => {
        const t = (width - CONFIG.CARD_MIN_WIDTH) / (CONFIG.CARD_MAX_WIDTH - CONFIG.CARD_MIN_WIDTH);
        return 0.5 + t * 0.5; // Range from 0.5 to 1.0
    };

    // Get brightness for collapsed image (dynamic based on width)
    getImageBrightness = (width) => {
        const t = (width - CONFIG.CARD_MIN_WIDTH) / (CONFIG.CARD_MAX_WIDTH - CONFIG.CARD_MIN_WIDTH);
        // Brighter when collapsed (0.75), slightly dimmer as it expands (0.6)
        return 0.75 - t * 0.15;
    };

    // Get expansion progress for content crossfade
    // Returns 1 only for active card, 0 for all others
    getExpansionProgress = (width) => {
        const threshold = CONFIG.CARD_MAX_WIDTH * 0.7;  // 224px - below adjacent card width
        const fullExpansion = CONFIG.CARD_MAX_WIDTH * 0.95; // 304px - near full width

        if (width >= fullExpansion) return 1;
        if (width <= threshold) return 0;

        // Smooth interpolation
        const t = (width - threshold) / (fullExpansion - threshold);
        return t * t * (3 - 2 * t); // Smoothstep
    };

    // Calculate scroll offset to center a specific card
    calculateCenterOffset = (targetIndex) => {
        const viewportCenter = this.getViewportCenter();
        const spacerWidth = this.getSpacerWidth();

        // Calculate position using widths as if targetIndex is centered
        let position = spacerWidth;

        for (let i = 0; i < targetIndex; i++) {
            const indexDistance = Math.abs(i - targetIndex);
            const width = this.getWidthForIndexDistance(indexDistance);
            position += width + CONFIG.CARD_GAP;
        }

        // Add half of the center card (full width)
        position += CONFIG.CARD_MAX_WIDTH / 2;

        return position - viewportCenter;
    };

    updateScroll = (scrollOffset, animate = false, forceActiveIndex = null) => {
        let activeIndex;
        let cardWidths;

        if (forceActiveIndex !== null) {
            // Clicking/snapping - use discrete index
            activeIndex = forceActiveIndex;
            cardWidths = this.calculateWidthsForActiveIndex(activeIndex);
        } else {
            // Dragging - use smooth interpolation
            const result = this.calculateSmoothWidths(scrollOffset);
            activeIndex = result.activeIndex;
            cardWidths = result.widths;
        }

        this.setState({ scrollOffset, cardWidths, activeIndex });

        const track = this.trackRef.current;
        if (track) {
            track.style.transition = animate ? 'transform 450ms cubic-bezier(0.23, 1, 0.32, 1)' : 'none';
            track.style.transform = `translateX(${-scrollOffset}px)`;
        }
    };

    // Calculate smoothly interpolated widths during drag
    calculateSmoothWidths = (scrollOffset) => {
        const { items } = this.props;

        // Get fractional position (e.g., 1.3 means 30% between card 1 and card 2)
        const fractionalIndex = this.getFractionalIndex(scrollOffset);
        const lowerIndex = Math.max(0, Math.floor(fractionalIndex));
        const upperIndex = Math.min(items.length - 1, Math.ceil(fractionalIndex));

        // Interpolation factor (0 to 1)
        const t = fractionalIndex - Math.floor(fractionalIndex);

        // If we're exactly on a card, no interpolation needed
        if (lowerIndex === upperIndex || t === 0) {
            return {
                activeIndex: lowerIndex,
                widths: this.calculateWidthsForActiveIndex(lowerIndex)
            };
        }

        // Get widths for both adjacent states
        const lowerWidths = this.calculateWidthsForActiveIndex(lowerIndex);
        const upperWidths = this.calculateWidthsForActiveIndex(upperIndex);

        // Smooth interpolation using eased t for more natural feel
        const easedT = t * t * (3 - 2 * t); // Smoothstep

        // Interpolate each card's width
        const widths = items.map((_, i) => {
            return lowerWidths[i] + (upperWidths[i] - lowerWidths[i]) * easedT;
        });

        // Active index is the one we're closer to
        const activeIndex = t < 0.5 ? lowerIndex : upperIndex;

        return { activeIndex, widths };
    };

    // Get fractional index from scroll offset (e.g., 1.3 = between card 1 and 2)
    getFractionalIndex = (scrollOffset) => {
        const { items } = this.props;

        if (items.length === 0) return 0;
        if (items.length === 1) return 0;

        const firstOffset = this.calculateCenterOffset(0);

        // Before first card
        if (scrollOffset <= firstOffset) {
            return 0;
        }

        // Find which two cards we're between
        let prevOffset = firstOffset;

        for (let i = 1; i < items.length; i++) {
            const currOffset = this.calculateCenterOffset(i);

            if (scrollOffset <= currOffset) {
                // We're between card (i-1) and card i
                const range = currOffset - prevOffset;
                if (range === 0) return i - 1;
                const progress = (scrollOffset - prevOffset) / range;
                return (i - 1) + Math.max(0, Math.min(1, progress));
            }

            prevOffset = currOffset;
        }

        // Past the last card
        return items.length - 1;
    };

    // Calculate widths when a specific card is active (symmetric)
    calculateWidthsForActiveIndex = (activeIndex) => {
        const { items } = this.props;
        const widths = [];

        for (let i = 0; i < items.length; i++) {
            const indexDistance = Math.abs(i - activeIndex);
            widths.push(this.getWidthForIndexDistance(indexDistance));
        }

        return widths;
    };

    snapToCard = (index, animate = true) => {
        const { items } = this.props;
        const clampedIndex = Math.max(0, Math.min(items.length - 1, index));

        // Calculate target offset for this index
        const targetOffset = this.calculateCenterOffset(clampedIndex);

        if (animate) {
            this.animateToOffset(targetOffset, clampedIndex);
        } else {
            this.updateScroll(targetOffset, false, clampedIndex);
        }
    };

    animateToOffset = (targetOffset, targetIndex = null) => {
        const startOffset = this.state.scrollOffset;
        const diff = targetOffset - startOffset;
        const duration = 600;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic for smooth deceleration
            const eased = 1 - Math.pow(1 - progress, 3);
            const currentOffset = startOffset + diff * eased;

            // Use smooth interpolation during animation (like dragging)
            // Only snap to final discrete widths at the very end
            if (progress < 1) {
                this.updateScroll(currentOffset, false, null); // null = use smooth interpolation
                this.animationFrame = requestAnimationFrame(animate);
            } else {
                // Animation complete - snap to final discrete state
                this.updateScroll(targetOffset, false, targetIndex);
            }
        };

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.animationFrame = requestAnimationFrame(animate);
    };

    // === DRAG HANDLING ===
    handleMouseDown = (e) => {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        this.isDragging = true;
        this.startX = e.clientX;
        this.lastX = e.clientX;
        this.lastTime = performance.now();
        this.velocity = 0;
        this.currentScrollOffset = this.state.scrollOffset; // Track directly
        this.setState({ hasDragged: false });

        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    };

    handleMouseMove = (e) => {
        if (!this.isDragging) return;

        const x = e.clientX;
        const delta = this.lastX - x;

        if (Math.abs(x - this.startX) > CONFIG.DRAG_THRESHOLD) {
            this.setState({ hasDragged: true });
        }

        // Calculate velocity with damping for smoother feel
        const now = performance.now();
        const dt = now - this.lastTime;
        if (dt > 0) {
            const rawVelocity = delta / dt;
            this.velocity = this.velocity * CONFIG.VELOCITY_DAMPING + rawVelocity * (1 - CONFIG.VELOCITY_DAMPING);
        }
        this.lastX = x;
        this.lastTime = now;

        // Update scroll offset directly (avoid async state issues)
        this.currentScrollOffset += delta;

        // Apply elastic bounds
        const { items } = this.props;
        const minOffset = this.calculateCenterOffset(0);
        const maxOffset = this.calculateCenterOffset(items.length - 1);

        let newOffset = this.currentScrollOffset;

        if (newOffset < minOffset) {
            const overscroll = minOffset - newOffset;
            newOffset = minOffset - overscroll * 0.3;
        } else if (newOffset > maxOffset) {
            const overscroll = newOffset - maxOffset;
            newOffset = maxOffset + overscroll * 0.3;
        }

        this.updateScroll(newOffset, false);
    };

    handleMouseUp = (e) => {
        if (!this.isDragging) return;

        this.isDragging = false;
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);

        // Only snap if we actually dragged, otherwise let the click handle it
        if (this.state.hasDragged) {
            this.snapToNearestCard();
        }
    };

    handleTouchStart = (e) => {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        const touch = e.touches[0];
        this.isDragging = true;
        this.startX = touch.clientX;
        this.lastX = touch.clientX;
        this.lastTime = performance.now();
        this.velocity = 0;
        this.currentScrollOffset = this.state.scrollOffset; // Track directly
        this.setState({ hasDragged: false });
    };

    handleTouchMove = (e) => {
        if (!this.isDragging) return;

        const touch = e.touches[0];
        const x = touch.clientX;
        const delta = this.lastX - x;

        if (Math.abs(x - this.startX) > CONFIG.DRAG_THRESHOLD) {
            e.preventDefault();
            this.setState({ hasDragged: true });
        }

        // Calculate velocity with damping
        const now = performance.now();
        const dt = now - this.lastTime;
        if (dt > 0) {
            const rawVelocity = delta / dt;
            this.velocity = this.velocity * CONFIG.VELOCITY_DAMPING + rawVelocity * (1 - CONFIG.VELOCITY_DAMPING);
        }
        this.lastX = x;
        this.lastTime = now;

        // Update scroll offset directly
        this.currentScrollOffset += delta;

        // Apply elastic bounds
        const { items } = this.props;
        const minOffset = this.calculateCenterOffset(0);
        const maxOffset = this.calculateCenterOffset(items.length - 1);

        let newOffset = this.currentScrollOffset;

        if (newOffset < minOffset) {
            const overscroll = minOffset - newOffset;
            newOffset = minOffset - overscroll * 0.3;
        } else if (newOffset > maxOffset) {
            const overscroll = newOffset - maxOffset;
            newOffset = maxOffset + overscroll * 0.3;
        }

        this.updateScroll(newOffset, false);
    };

    handleTouchEnd = () => {
        if (!this.isDragging) return;

        this.isDragging = false;

        // Only snap if we actually dragged
        if (this.state.hasDragged) {
            this.snapToNearestCard();
        } else {
            this.setState({ hasDragged: false });
        }
    };

    snapToNearestCard = () => {
        const { items } = this.props;
        const { scrollOffset } = this.state;

        // Apply momentum
        const momentum = this.velocity * CONFIG.MOMENTUM_MULTIPLIER;
        const projectedOffset = scrollOffset + momentum;

        // Find nearest card using fractional index
        const fractionalIndex = this.getFractionalIndex(projectedOffset);
        const nearestIndex = Math.round(fractionalIndex);

        // Clamp and snap
        const clampedIndex = Math.max(0, Math.min(items.length - 1, nearestIndex));

        // Reset hasDragged
        this.setState({ hasDragged: false });

        // Snap to the card
        this.snapToCard(clampedIndex, true);
    };

    handleCardClick = (index) => {
        // Only respond to click if we didn't drag
        if (!this.state.hasDragged) {
            this.snapToCard(index, true);
        }
    };

    handlePrev = () => {
        const { activeIndex } = this.state;
        if (activeIndex > 0) {
            this.snapToCard(activeIndex - 1, true);
        }
    };

    handleNext = () => {
        const { items } = this.props;
        const { activeIndex } = this.state;
        if (activeIndex < items.length - 1) {
            this.snapToCard(activeIndex + 1, true);
        }
    };

    // === RENDER ===
    renderCollapsedContent = (item, brightness) => {
        const { classes } = this.props;

        return (
            <div className={classes.collapsedContent}>
                <img
                    src={item.image}
                    alt={item.name}
                    className={`${classes.collapsedImage} pixelated`}
                    style={{ filter: `brightness(${brightness})` }}
                    draggable={false}
                />
                <div className={classes.collapsedGradient} />
                <span className={classes.verticalLabel}>
                    {item.name}
                </span>
            </div>
        );
    };

    renderExpandedContent = (item, opacity) => {
        const { classes } = this.props;

        return (
            <div
                className={classes.expandedContent}
                style={{
                    opacity,
                    pointerEvents: opacity > 0.5 ? 'auto' : 'none',
                }}
            >
                <img
                    src={item.image}
                    alt={item.name}
                    className={`${classes.avatar} pixelated`}
                    draggable={false}
                />
                <div className={classes.name}>{item.name}</div>
                <div className={classes.role}>{item.role}</div>
                <div className={classes.country}>{item.country}</div>
                <a
                    href={item.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={classes.actionButton}
                    onClick={(e) => e.stopPropagation()}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                    </svg>
                    {t("words.view_profile")}
                </a>
            </div>
        );
    };

    render() {
        const { classes, items } = this.props;
        const { activeIndex, cardWidths } = this.state;

        return (
            <div className={classes.wrapper} ref={this.wrapperRef}>
                {/* Navigation */}
                <button
                    className={`${classes.navButton} ${classes.navButtonLeft}`}
                    onClick={this.handlePrev}
                    disabled={activeIndex === 0}
                    aria-label={t("words.previous")}
                >
                    <svg className={classes.navIcon} viewBox="0 0 24 24">
                        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                    </svg>
                </button>
                <button
                    className={`${classes.navButton} ${classes.navButtonRight}`}
                    onClick={this.handleNext}
                    disabled={activeIndex === items.length - 1}
                    aria-label={t("words.next")}
                >
                    <svg className={classes.navIcon} viewBox="0 0 24 24">
                        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                    </svg>
                </button>
                {/* Track */}
                <div
                    ref={this.trackRef}
                    className={classes.track}
                    onMouseDown={this.handleMouseDown}
                >
                    <div className={classes.spacer} style={{ width: this.getSpacerWidth() }} />

                    {items.map((item, index) => {
                        const width = cardWidths[index] || CONFIG.CARD_MIN_WIDTH;
                        const opacity = this.getCardOpacity(width);
                        const expansionProgress = this.getExpansionProgress(width);
                        const brightness = this.getImageBrightness(width);
                        const isMainCard = width > CONFIG.CARD_MAX_WIDTH * 0.8;

                        return (
                            <div
                                key={item.id || index}
                                className={classes.card}
                                style={{
                                    width: `${width}px`,
                                    opacity,
                                    boxShadow: isMainCard
                                        ? '0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)'
                                        : 'none',
                                }}
                                onClick={() => this.handleCardClick(index)}
                                ref={el => this.cardsRef[index] = el}
                            >
                                {/* Collapsed content (always rendered, fades out completely) */}
                                <div style={{
                                    opacity: 1 - expansionProgress,
                                    height: '100%',
                                    position: 'absolute',
                                    inset: 0,
                                    pointerEvents: expansionProgress > 0.5 ? 'none' : 'auto',
                                }}>
                                    {this.renderCollapsedContent(item, brightness)}
                                </div>

                                {/* Expanded content (fades in) */}
                                {this.renderExpandedContent(item, expansionProgress)}
                            </div>
                        );
                    })}

                    <div className={classes.spacer} style={{ width: this.getSpacerWidth() }} />
                </div>
                {/* Pagination */}
                <div className={classes.pagination}>
                    {items.map((_, index) => (
                        <button
                            key={index}
                            className={`${classes.pageIndicator} ${index === activeIndex ? classes.pageIndicatorActive : ''}`}
                            onClick={() => this.snapToCard(index, true)}
                            aria-label={t("words.go_to_slide_index", {
                                index: index + 1
                            })}
                        />
                    ))}
                </div>
            </div>
        );
    }
}

export default withLanguage(withStyles(styles)(MD3ElasticCarousel));