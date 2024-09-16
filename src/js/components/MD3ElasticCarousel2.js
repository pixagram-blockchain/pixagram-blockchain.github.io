import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
/**
 * MD3 Elastic Carousel — Infinite, Auto-advancing
 *
 * Material Design 3 carousel with:
 * - ONE main card at full width, others at elastic widths
 * - Continuous interpolation during scroll/drag
 * - Smooth momentum physics
 * - Infinite loop via virtual tripled items
 * - Auto-advance with pause on interaction
 * - Roll-in entrance animation
 */

const CONFIG = {
    CARD_MAX_WIDTH: 340,
    CARD_MIN_WIDTH: 56,
    CARD_HEIGHT: 320,
    CARD_GAP: 8,

    DRAG_THRESHOLD: 5,
    MOMENTUM_MULTIPLIER: 80,
    VELOCITY_DAMPING: 0.92,

    // Auto-play
    AUTO_PLAY_INTERVAL: 3400,     // ms between auto-advances
    AUTO_PLAY_RESUME_DELAY: 5000, // ms after interaction before resuming

    // Roll-in animation
    ROLL_IN_BASE_DELAY: 60,
    ROLL_IN_STAGGER: 35,
    ROLL_IN_DURATION: 900,
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

    // === EXPANDED CONTENT (main card — full image) ===
    expandedContent: {
        width: '100%',
        height: '100%',
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        borderRadius: '24px',
    },
    expandedImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    expandedOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '40%',
        background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.35) 100%)',
        pointerEvents: 'none',
    },

    // === NAVIGATION ===
    navButton: {
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: '#ffffff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 300ms ease',
        zIndex: 10,
        backdropFilter: 'blur(12px)',
        '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.15)',
            transform: 'translateY(-50%) scale(1.08)',
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
        backgroundColor: 'rgba(255,255,255,0.15)',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        transition: 'all 350ms cubic-bezier(0.23, 1, 0.32, 1)',
        '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.3)',
            transform: 'scale(1.2)',
        },
    },
    pageIndicatorActive: {
        width: '28px',
        borderRadius: '4px',
        backgroundColor: 'rgba(255,255,255,0.7)',
    },
});

class MD3ElasticCarousel extends React.Component {
    constructor(props) {
        super(props);

        // Real item count
        this._realCount = props.items ? props.items.length : 0;

        // Virtual items: triple the array for infinite looping
        this._virtualItems = this._buildVirtualItems(props.items);

        // Start in the center of the middle copy, at the middle item
        const startIndex = this._realCount + Math.floor(this._realCount / 2);

        this.state = {
            scrollOffset: 0,
            activeIndex: startIndex,
            cardWidths: [],
            hasDragged: false,
            rolledIn: false,
            cardVisibility: [],
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
        this._rollInTimers = [];

        // Auto-play
        this._autoPlayTimer = null;
        this._autoPlayResumeTimer = null;
        this._autoPlayPaused = false;
    }

    _buildVirtualItems = (items) => {
        if (!items || !items.length) return [];
        return [...items, ...items, ...items];
    };

    // Map a virtual index to the real (original) item index
    _toRealIndex = (virtualIndex) => {
        if (this._realCount === 0) return 0;
        return ((virtualIndex % this._realCount) + this._realCount) % this._realCount;
    };

    // Center copy range: [_realCount .. _realCount * 2 - 1]
    _centerStart = () => this._realCount;
    _centerEnd = () => this._realCount * 2 - 1;

    componentDidMount() {
        this.initializeCardWidths();

        const wrapper = this.wrapperRef.current;
        if (wrapper) {
            wrapper.addEventListener('touchstart', this.handleTouchStart, { passive: true });
            wrapper.addEventListener('touchmove', this.handleTouchMove, { passive: false });
            wrapper.addEventListener('touchend', this.handleTouchEnd, { passive: true });
        }

        window.addEventListener('resize', this.handleResize);

        // Initial snap to center (no animation)
        requestAnimationFrame(() => {
            this.snapToCard(this.state.activeIndex, false);
            this._startRollIn();
        });
    }

    componentWillUnmount() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        this._rollInTimers.forEach(t => clearTimeout(t));
        this._rollInTimers = [];
        this._stopAutoPlay();
        clearTimeout(this._autoPlayResumeTimer);

        const wrapper = this.wrapperRef.current;
        if (wrapper) {
            wrapper.removeEventListener('touchstart', this.handleTouchStart);
            wrapper.removeEventListener('touchmove', this.handleTouchMove);
            wrapper.removeEventListener('touchend', this.handleTouchEnd);
        }

        window.removeEventListener('resize', this.handleResize);
    }

    // ── Roll-in Animation ──
    _startRollIn = () => {
        const total = this._virtualItems.length;
        if (!total) return;

        const visibility = new Array(total).fill(false);
        this.setState({ cardVisibility: visibility });

        for (let i = 0; i < total; i++) {
            const normalizedPos = i / Math.max(total - 1, 1);
            const delay = CONFIG.ROLL_IN_BASE_DELAY +
                Math.pow(normalizedPos, 0.45) * (CONFIG.ROLL_IN_STAGGER * total);

            const timer = setTimeout(() => {
                this.setState(prev => {
                    const vis = [...prev.cardVisibility];
                    vis[i] = true;
                    return { cardVisibility: vis };
                });
            }, delay);
            this._rollInTimers.push(timer);
        }

        // Mark roll-in complete → start auto-play
        const totalDuration = CONFIG.ROLL_IN_BASE_DELAY +
            CONFIG.ROLL_IN_STAGGER * total + CONFIG.ROLL_IN_DURATION;
        const completeTimer = setTimeout(() => {
            this.setState({ rolledIn: true });
            this._startAutoPlay();
        }, totalDuration);
        this._rollInTimers.push(completeTimer);
    };

    // ── Auto-Play ──
    _startAutoPlay = () => {
        this._stopAutoPlay();
        this._autoPlayPaused = false;
        this._autoPlayTimer = setInterval(() => {
            if (this._autoPlayPaused || this.isDragging) return;
            this._autoAdvance();
        }, CONFIG.AUTO_PLAY_INTERVAL);
    };

    _stopAutoPlay = () => {
        if (this._autoPlayTimer) {
            clearInterval(this._autoPlayTimer);
            this._autoPlayTimer = null;
        }
    };

    _pauseAutoPlay = () => {
        this._autoPlayPaused = true;
        clearTimeout(this._autoPlayResumeTimer);
    };

    _resumeAutoPlayAfterDelay = () => {
        clearTimeout(this._autoPlayResumeTimer);
        this._autoPlayResumeTimer = setTimeout(() => {
            this._autoPlayPaused = false;
        }, CONFIG.AUTO_PLAY_RESUME_DELAY);
    };

    _autoAdvance = () => {
        const { activeIndex } = this.state;
        this.snapToCard(activeIndex + 1, true);
    };

    // ── Infinite Loop: Silent Teleport ──
    // After any snap completes, if outside the center copy, teleport silently
    _normalizeAfterSnap = (virtualIndex) => {
        if (this._realCount === 0) return;

        const cs = this._centerStart();
        const ce = this._centerEnd();

        if (virtualIndex < cs || virtualIndex > ce) {
            // Find equivalent index in center copy
            const realIdx = this._toRealIndex(virtualIndex);
            const centerIdx = cs + realIdx;

            // Teleport: update scroll position instantly, no animation
            requestAnimationFrame(() => {
                const targetOffset = this.calculateCenterOffset(centerIdx);
                this.currentScrollOffset = targetOffset;

                const track = this.trackRef.current;
                if (track) {
                    track.style.transition = 'none';
                    track.style.transform = `translateX(${-targetOffset}px)`;
                }

                const cardWidths = this.calculateWidthsForActiveIndex(centerIdx);
                this.setState({
                    scrollOffset: targetOffset,
                    activeIndex: centerIdx,
                    cardWidths,
                });
            });
        }
    };

    handleResize = () => {
        this.initializeCardWidths();
        this.snapToCard(this.state.activeIndex, false);
    };

    initializeCardWidths = () => {
        const cardWidths = this._virtualItems.map(() => CONFIG.CARD_MIN_WIDTH);
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

    getWidthForIndexDistance = (indexDistance) => {
        switch (indexDistance) {
            case 0: return CONFIG.CARD_MAX_WIDTH;
            case 1: return CONFIG.CARD_MAX_WIDTH * 0.5;
            case 2: return CONFIG.CARD_MAX_WIDTH * 0.3;
            default: return CONFIG.CARD_MIN_WIDTH;
        }
    };

    getCardOpacity = (width) => {
        const t = (width - CONFIG.CARD_MIN_WIDTH) / (CONFIG.CARD_MAX_WIDTH - CONFIG.CARD_MIN_WIDTH);
        return 0.5 + t * 0.5;
    };

    getImageBrightness = (width) => {
        const t = (width - CONFIG.CARD_MIN_WIDTH) / (CONFIG.CARD_MAX_WIDTH - CONFIG.CARD_MIN_WIDTH);
        return 0.75 - t * 0.15;
    };

    getExpansionProgress = (width) => {
        const threshold = CONFIG.CARD_MAX_WIDTH * 0.7;
        const fullExpansion = CONFIG.CARD_MAX_WIDTH * 0.95;

        if (width >= fullExpansion) return 1;
        if (width <= threshold) return 0;

        const t = (width - threshold) / (fullExpansion - threshold);
        return t * t * (3 - 2 * t);
    };

    calculateCenterOffset = (targetIndex) => {
        const viewportCenter = this.getViewportCenter();
        const spacerWidth = this.getSpacerWidth();

        let position = spacerWidth;

        for (let i = 0; i < targetIndex; i++) {
            const indexDistance = Math.abs(i - targetIndex);
            const width = this.getWidthForIndexDistance(indexDistance);
            position += width + CONFIG.CARD_GAP;
        }

        position += CONFIG.CARD_MAX_WIDTH / 2;
        return position - viewportCenter;
    };

    updateScroll = (scrollOffset, animate = false, forceActiveIndex = null) => {
        let activeIndex;
        let cardWidths;

        if (forceActiveIndex !== null) {
            activeIndex = forceActiveIndex;
            cardWidths = this.calculateWidthsForActiveIndex(activeIndex);
        } else {
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

    calculateSmoothWidths = (scrollOffset) => {
        const totalItems = this._virtualItems.length;

        const fractionalIndex = this.getFractionalIndex(scrollOffset);
        const lowerIndex = Math.max(0, Math.floor(fractionalIndex));
        const upperIndex = Math.min(totalItems - 1, Math.ceil(fractionalIndex));

        const t = fractionalIndex - Math.floor(fractionalIndex);

        if (lowerIndex === upperIndex || t === 0) {
            return {
                activeIndex: lowerIndex,
                widths: this.calculateWidthsForActiveIndex(lowerIndex)
            };
        }

        const lowerWidths = this.calculateWidthsForActiveIndex(lowerIndex);
        const upperWidths = this.calculateWidthsForActiveIndex(upperIndex);

        const easedT = t * t * (3 - 2 * t);

        const widths = this._virtualItems.map((_, i) => {
            return lowerWidths[i] + (upperWidths[i] - lowerWidths[i]) * easedT;
        });

        const activeIndex = t < 0.5 ? lowerIndex : upperIndex;
        return { activeIndex, widths };
    };

    getFractionalIndex = (scrollOffset) => {
        const totalItems = this._virtualItems.length;

        if (totalItems === 0) return 0;
        if (totalItems === 1) return 0;

        const firstOffset = this.calculateCenterOffset(0);

        if (scrollOffset <= firstOffset) return 0;

        let prevOffset = firstOffset;

        for (let i = 1; i < totalItems; i++) {
            const currOffset = this.calculateCenterOffset(i);

            if (scrollOffset <= currOffset) {
                const range = currOffset - prevOffset;
                if (range === 0) return i - 1;
                const progress = (scrollOffset - prevOffset) / range;
                return (i - 1) + Math.max(0, Math.min(1, progress));
            }

            prevOffset = currOffset;
        }

        return totalItems - 1;
    };

    calculateWidthsForActiveIndex = (activeIndex) => {
        const totalItems = this._virtualItems.length;
        const widths = [];

        for (let i = 0; i < totalItems; i++) {
            const indexDistance = Math.abs(i - activeIndex);
            widths.push(this.getWidthForIndexDistance(indexDistance));
        }

        return widths;
    };

    snapToCard = (index, animate = true) => {
        const totalItems = this._virtualItems.length;
        const wrappedIndex = Math.max(0, Math.min(totalItems - 1, index));
        const targetOffset = this.calculateCenterOffset(wrappedIndex);

        if (animate) {
            this.animateToOffset(targetOffset, wrappedIndex);
        } else {
            this.updateScroll(targetOffset, false, wrappedIndex);
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

            const eased = 1 - Math.pow(1 - progress, 3);
            const currentOffset = startOffset + diff * eased;

            if (progress < 1) {
                this.updateScroll(currentOffset, false, null);
                this.animationFrame = requestAnimationFrame(animate);
            } else {
                this.updateScroll(targetOffset, false, targetIndex);
                // Teleport back to center copy if needed
                if (targetIndex !== null) {
                    this._normalizeAfterSnap(targetIndex);
                }
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
        this._pauseAutoPlay();

        this.isDragging = true;
        this.startX = e.clientX;
        this.lastX = e.clientX;
        this.lastTime = performance.now();
        this.velocity = 0;
        this.currentScrollOffset = this.state.scrollOffset;
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

        const now = performance.now();
        const dt = now - this.lastTime;
        if (dt > 0) {
            const rawVelocity = delta / dt;
            this.velocity = this.velocity * CONFIG.VELOCITY_DAMPING + rawVelocity * (1 - CONFIG.VELOCITY_DAMPING);
        }
        this.lastX = x;
        this.lastTime = now;

        // No elastic bounds — infinite scroll
        this.currentScrollOffset += delta;
        this.updateScroll(this.currentScrollOffset, false);
    };

    handleMouseUp = () => {
        if (!this.isDragging) return;
        this.isDragging = false;
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);

        if (this.state.hasDragged) {
            this.snapToNearestCard();
        }
        this._resumeAutoPlayAfterDelay();
    };

    handleTouchStart = (e) => {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this._pauseAutoPlay();

        const touch = e.touches[0];
        this.isDragging = true;
        this.startX = touch.clientX;
        this.lastX = touch.clientX;
        this.lastTime = performance.now();
        this.velocity = 0;
        this.currentScrollOffset = this.state.scrollOffset;
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

        const now = performance.now();
        const dt = now - this.lastTime;
        if (dt > 0) {
            const rawVelocity = delta / dt;
            this.velocity = this.velocity * CONFIG.VELOCITY_DAMPING + rawVelocity * (1 - CONFIG.VELOCITY_DAMPING);
        }
        this.lastX = x;
        this.lastTime = now;

        // No elastic bounds — infinite scroll
        this.currentScrollOffset += delta;
        this.updateScroll(this.currentScrollOffset, false);
    };

    handleTouchEnd = () => {
        if (!this.isDragging) return;
        this.isDragging = false;

        if (this.state.hasDragged) {
            this.snapToNearestCard();
        } else {
            this.setState({ hasDragged: false });
        }
        this._resumeAutoPlayAfterDelay();
    };

    snapToNearestCard = () => {
        const totalItems = this._virtualItems.length;
        const { scrollOffset } = this.state;

        const momentum = this.velocity * CONFIG.MOMENTUM_MULTIPLIER;
        const projectedOffset = scrollOffset + momentum;

        const fractionalIndex = this.getFractionalIndex(projectedOffset);
        const nearestIndex = Math.round(fractionalIndex);
        const safeIndex = Math.max(0, Math.min(totalItems - 1, nearestIndex));

        this.setState({ hasDragged: false });
        this.snapToCard(safeIndex, true);
    };

    handleCardClick = (index) => {
        if (!this.state.hasDragged) {
            this._pauseAutoPlay();
            this.snapToCard(index, true);
            this._resumeAutoPlayAfterDelay();
        }
    };

    handlePrev = () => {
        this._pauseAutoPlay();
        this.snapToCard(this.state.activeIndex - 1, true);
        this._resumeAutoPlayAfterDelay();
    };

    handleNext = () => {
        this._pauseAutoPlay();
        this.snapToCard(this.state.activeIndex + 1, true);
        this._resumeAutoPlayAfterDelay();
    };

    // === RENDER ===
    renderCollapsedContent = (item, brightness) => {
        const { classes } = this.props;

        return (
            <div className={classes.collapsedContent}>
                <img
                    src={item.image}
                    alt={item.name || 'Pixel art'}
                    className={`${classes.collapsedImage} pixelated`}
                    style={{ filter: `brightness(${brightness})` }}
                    draggable={false}
                />
                <div className={classes.collapsedGradient} />
                {item.name && (
                    <span className={classes.verticalLabel}>
                        {item.name}
                    </span>
                )}
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
                    alt={item.name || 'Pixel art'}
                    className={`${classes.expandedImage} pixelated`}
                    draggable={false}
                />
                <div className={classes.expandedOverlay} />
            </div>
        );
    };

    render() {
        const { classes, items } = this.props;
        const { activeIndex, cardWidths, cardVisibility, rolledIn } = this.state;

        // Current real index for pagination highlight
        const currentRealIndex = this._toRealIndex(activeIndex);

        return (
            <div className={classes.wrapper} ref={this.wrapperRef}>
                {/* Navigation — always enabled (infinite) */}
                <button
                    className={`${classes.navButton} ${classes.navButtonLeft}`}
                    onClick={this.handlePrev}
                    aria-label={t("words.previous")}
                    style={{ opacity: rolledIn ? 1 : 0, transition: 'opacity 400ms ease' }}
                >
                    <svg className={classes.navIcon} viewBox="0 0 24 24">
                        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                    </svg>
                </button>
                <button
                    className={`${classes.navButton} ${classes.navButtonRight}`}
                    onClick={this.handleNext}
                    aria-label={t("words.next")}
                    style={{ opacity: rolledIn ? 1 : 0, transition: 'opacity 400ms ease' }}
                >
                    <svg className={classes.navIcon} viewBox="0 0 24 24">
                        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                    </svg>
                </button>
                {/* Track — renders virtual (tripled) items */}
                <div
                    ref={this.trackRef}
                    className={classes.track}
                    onMouseDown={this.handleMouseDown}
                >
                    <div className={classes.spacer} style={{ width: this.getSpacerWidth() }} />

                    {this._virtualItems.map((item, index) => {
                        const width = cardWidths[index] || CONFIG.CARD_MIN_WIDTH;
                        const opacity = this.getCardOpacity(width);
                        const expansionProgress = this.getExpansionProgress(width);
                        const brightness = this.getImageBrightness(width);
                        const isMainCard = width > CONFIG.CARD_MAX_WIDTH * 0.8;

                        // Roll-in
                        const isVisible = cardVisibility[index];
                        const rollInStyle = {
                            transform: isVisible
                                ? 'translateX(0) scale(1)'
                                : `translateX(${120 + (this._virtualItems.length - index) * 4}vw) scale(0.7)`,
                            opacity: isVisible ? opacity : 0,
                            transition: isVisible
                                ? `transform ${CONFIG.ROLL_IN_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${CONFIG.ROLL_IN_DURATION * 0.4}ms ease-out`
                                : 'none',
                        };

                        return (
                            <div
                                key={`v-${index}`}
                                className={classes.card}
                                style={{
                                    width: `${width}px`,
                                    ...rollInStyle,
                                    boxShadow: isMainCard
                                        ? '0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)'
                                        : '0 1px 3px rgba(0,0,0,0.2)',
                                }}
                                onClick={() => this.handleCardClick(index)}
                                ref={el => this.cardsRef[index] = el}
                            >
                                {/* Collapsed content */}
                                <div style={{
                                    opacity: 1 - expansionProgress,
                                    height: '100%',
                                    position: 'absolute',
                                    inset: 0,
                                    pointerEvents: expansionProgress > 0.5 ? 'none' : 'auto',
                                }}>
                                    {this.renderCollapsedContent(item, brightness)}
                                </div>

                                {/* Expanded content */}
                                {this.renderExpandedContent(item, expansionProgress)}
                            </div>
                        );
                    })}

                    <div className={classes.spacer} style={{ width: this.getSpacerWidth() }} />
                </div>
                {/* Pagination — shows real item count, highlights current */}
                <div className={classes.pagination} style={{ opacity: rolledIn ? 1 : 0, transition: 'opacity 600ms ease 200ms' }}>
                    {items.map((_, index) => (
                        <button
                            key={index}
                            className={`${classes.pageIndicator} ${index === currentRealIndex ? classes.pageIndicatorActive : ''}`}
                            onClick={() => {
                                this._pauseAutoPlay();
                                this.snapToCard(this._centerStart() + index, true);
                                this._resumeAutoPlayAfterDelay();
                            }}
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