import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
/**
 * MD3 Progressive Width Carousel
 * 
 * Material Design 3 inspired carousel with:
 * - Progressive card widths (center-focused)
 * - Momentum-based scrolling with physics
 * - Elastic overscroll bounds
 * - Swipe/drag/touch support
 * - Adaptive content (collapsed vs expanded)
 */

const CARD_SIZES = {
    ACTIVE: 320,
    LARGE: 240,
    MEDIUM: 100,
    SMALL: 56,
};

const CARD_GAP = 12;
const DRAG_THRESHOLD = 5; // pixels before considered a drag vs click

const styles = theme => ({
    // === WRAPPER ===
    wrapper: {
        position: 'relative',
        width: '100%',
        overflow: 'hidden',
        padding: '24px 0',
        touchAction: 'pan-y',
    },
    
    // === TRACK ===
    track: {
        display: 'flex',
        alignItems: 'center',
        gap: `${CARD_GAP}px`,
        cursor: 'grab',
        userSelect: 'none',
        willChange: 'transform',
        transition: 'none',
        '&:active': {
            cursor: 'grabbing',
        },
    },
    trackAnimating: {
        transition: 'transform 450ms cubic-bezier(0.23, 1, 0.32, 1)',
    },
    
    // === SPACER ===
    spacer: {
        flexShrink: 0,
    },
    
    // === CARD BASE ===
    card: {
        flexShrink: 0,
        borderRadius: '24px',
        overflow: 'hidden',
        background: 'linear-gradient(145deg, #1a1a1a 0%, #141414 100%)',
        position: 'relative',
        height: '400px',
        transition: 'width 450ms cubic-bezier(0.23, 1, 0.32, 1), ' +
                   'opacity 350ms ease, ' +
                   'box-shadow 350ms ease, ' +
                   'transform 350ms ease',
        border: '1px solid rgba(255,255,255,0.04)',
    },
    cardClickable: {
        cursor: 'pointer',
        '&:hover': {
            transform: 'scale(1.02)',
        },
    },
    cardActive: {
        boxShadow: '0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
    },
    
    // === COLLAPSED STATE ===
    collapsedContainer: {
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    collapsedImageWrapper: {
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
    },
    collapsedImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        filter: 'brightness(0.5) saturate(0.8)',
        transition: 'filter 400ms ease',
    },
    collapsedGradient: {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%)',
    },
    verticalLabel: {
        position: 'relative',
        zIndex: 2,
        writingMode: 'vertical-rl',
        textOrientation: 'mixed',
        transform: 'rotate(180deg)',
        fontSize: '13px',
        fontWeight: '600',
        color: '#ffffff',
        letterSpacing: '3px',
        textTransform: 'uppercase',
        textShadow: '0 2px 12px rgba(0,0,0,0.9)',
        padding: '20px 0',
        maxHeight: 'calc(100% - 40px)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    
    // === EXPANDED STATE ===
    expandedContainer: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box',
        opacity: 1,
        transition: 'opacity 300ms ease 100ms',
    },
    expandedHidden: {
        opacity: 0,
        pointerEvents: 'none',
        transition: 'opacity 200ms ease',
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
        transition: 'transform 300ms ease',
    },
    name: {
        fontSize: '20px',
        fontWeight: '700',
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: '8px',
        letterSpacing: '-0.02em',
    },
    role: {
        fontSize: '14px',
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        marginBottom: '4px',
        fontWeight: '500',
    },
    country: {
        fontSize: '12px',
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        marginBottom: '20px',
    },
    actionButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '10px 20px',
        backgroundColor: 'rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.8)',
        borderRadius: '12px',
        textDecoration: 'none',
        fontSize: '13px',
        fontWeight: '500',
        transition: 'all 300ms ease',
        border: '1px solid rgba(255,255,255,0.06)',
        '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: '#ffffff',
            transform: 'translateY(-2px)',
        },
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
        transition: 'all 300ms cubic-bezier(0.23, 1, 0.32, 1)',
        zIndex: 10,
        backdropFilter: 'blur(12px)',
        '&:hover:not(:disabled)': {
            backgroundColor: 'rgba(255,255,255,0.15)',
            transform: 'translateY(-50%) scale(1.08)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        },
        '&:active:not(:disabled)': {
            transform: 'translateY(-50%) scale(0.95)',
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

class MD3ProgressiveCarousel extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            activeIndex: props.initialIndex || 0,
            isAnimating: false,
            hasDragged: false,
        };
        
        this.trackRef = React.createRef();
        this.wrapperRef = React.createRef();
        
        // Drag state (not in React state for performance)
        this.isDragging = false;
        this.startX = 0;
        this.currentX = 0;
        this.scrollOffset = 0;
        this.lastX = 0;
        this.lastTime = 0;
        this.velocity = 0;
        this.animationFrame = null;
    }

    componentDidMount() {
        this.updateTrackPosition(false);
        
        // Passive touch listeners for better scroll performance
        const wrapper = this.wrapperRef.current;
        if (wrapper) {
            wrapper.addEventListener('touchstart', this.handleTouchStart, { passive: true });
            wrapper.addEventListener('touchmove', this.handleTouchMove, { passive: false });
            wrapper.addEventListener('touchend', this.handleTouchEnd, { passive: true });
        }
        
        window.addEventListener('resize', this.handleResize);
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
        this.updateTrackPosition(false);
    };

    // === SIZE CALCULATIONS ===
    getCardWidth = (index, activeIndex = this.state.activeIndex) => {
        const distance = Math.abs(index - activeIndex);
        if (distance === 0) return CARD_SIZES.ACTIVE;
        if (distance === 1) return CARD_SIZES.LARGE;
        if (distance === 2) return CARD_SIZES.MEDIUM;
        return CARD_SIZES.SMALL;
    };

    getCardOpacity = (index) => {
        const { activeIndex } = this.state;
        const distance = Math.abs(index - activeIndex);
        if (distance === 0) return 1;
        if (distance === 1) return 0.85;
        if (distance === 2) return 0.6;
        return 0.4;
    };

    getSpacerWidth = () => {
        const wrapper = this.wrapperRef.current;
        if (!wrapper) return 0;
        return (wrapper.offsetWidth - CARD_SIZES.ACTIVE) / 2;
    };

    // === POSITION CALCULATIONS ===
    calculateScrollPosition = (targetIndex) => {
        const { items } = this.props;
        let position = this.getSpacerWidth();
        
        for (let i = 0; i < targetIndex; i++) {
            position += this.getCardWidth(i, targetIndex) + CARD_GAP;
        }
        
        // Center the active card
        position += this.getCardWidth(targetIndex, targetIndex) / 2;
        
        const wrapper = this.wrapperRef.current;
        if (wrapper) {
            position -= wrapper.offsetWidth / 2;
        }
        
        return position;
    };

    updateTrackPosition = (animate = true) => {
        const { activeIndex } = this.state;
        const targetPosition = this.calculateScrollPosition(activeIndex);
        
        this.scrollOffset = targetPosition;
        
        const track = this.trackRef.current;
        if (track) {
            if (animate) {
                this.setState({ isAnimating: true });
                setTimeout(() => this.setState({ isAnimating: false }), 450);
            }
            track.style.transform = `translateX(${-targetPosition}px)`;
        }
    };

    // === DRAG HANDLING ===
    handleMouseDown = (e) => {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        this.isDragging = true;
        this.startX = e.clientX;
        this.currentX = e.clientX;
        this.lastX = e.clientX;
        this.lastTime = performance.now();
        this.velocity = 0;
        this.setState({ hasDragged: false, isAnimating: false });
        
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    };

    handleMouseMove = (e) => {
        if (!this.isDragging) return;
        
        const x = e.clientX;
        const delta = this.currentX - x;
        
        // Check if we've exceeded drag threshold
        if (Math.abs(x - this.startX) > DRAG_THRESHOLD) {
            this.setState({ hasDragged: true });
        }
        
        // Calculate velocity
        const now = performance.now();
        const dt = now - this.lastTime;
        if (dt > 0) {
            this.velocity = (this.lastX - x) / dt;
        }
        this.lastX = x;
        this.lastTime = now;
        this.currentX = x;
        
        // Apply with elastic bounds
        const newOffset = this.scrollOffset + delta;
        const { items } = this.props;
        const minOffset = -100;
        const maxOffset = this.calculateScrollPosition(items.length - 1) + 100;
        
        let elasticOffset = newOffset;
        if (newOffset < minOffset) {
            elasticOffset = minOffset + (newOffset - minOffset) * 0.3;
        } else if (newOffset > maxOffset) {
            elasticOffset = maxOffset + (newOffset - maxOffset) * 0.3;
        }
        
        this.scrollOffset = newOffset;
        
        const track = this.trackRef.current;
        if (track) {
            track.style.transform = `translateX(${-elasticOffset}px)`;
        }
    };

    handleMouseUp = () => {
        this.isDragging = false;
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        
        this.snapToNearestCard();
    };

    handleTouchStart = (e) => {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        const touch = e.touches[0];
        this.isDragging = true;
        this.startX = touch.clientX;
        this.currentX = touch.clientX;
        this.lastX = touch.clientX;
        this.lastTime = performance.now();
        this.velocity = 0;
        this.setState({ hasDragged: false, isAnimating: false });
    };

    handleTouchMove = (e) => {
        if (!this.isDragging) return;
        
        const touch = e.touches[0];
        const x = touch.clientX;
        const delta = this.currentX - x;
        
        // Prevent page scroll when dragging carousel
        if (Math.abs(x - this.startX) > DRAG_THRESHOLD) {
            e.preventDefault();
            this.setState({ hasDragged: true });
        }
        
        // Calculate velocity
        const now = performance.now();
        const dt = now - this.lastTime;
        if (dt > 0) {
            this.velocity = (this.lastX - x) / dt;
        }
        this.lastX = x;
        this.lastTime = now;
        this.currentX = x;
        
        // Apply with elastic bounds
        const newOffset = this.scrollOffset + delta;
        const { items } = this.props;
        const minOffset = -100;
        const maxOffset = this.calculateScrollPosition(items.length - 1) + 100;
        
        let elasticOffset = newOffset;
        if (newOffset < minOffset) {
            elasticOffset = minOffset + (newOffset - minOffset) * 0.3;
        } else if (newOffset > maxOffset) {
            elasticOffset = maxOffset + (newOffset - maxOffset) * 0.3;
        }
        
        this.scrollOffset = newOffset;
        
        const track = this.trackRef.current;
        if (track) {
            track.style.transform = `translateX(${-elasticOffset}px)`;
        }
    };

    handleTouchEnd = () => {
        this.isDragging = false;
        this.snapToNearestCard();
    };

    snapToNearestCard = () => {
        const { items } = this.props;
        const { activeIndex } = this.state;
        
        // Apply momentum
        const momentum = this.velocity * 120;
        const projectedOffset = this.scrollOffset + momentum;
        
        // Find nearest card center
        const wrapper = this.wrapperRef.current;
        if (!wrapper) return;
        
        const viewportCenter = projectedOffset + wrapper.offsetWidth / 2;
        
        let position = this.getSpacerWidth();
        let nearestIndex = 0;
        let minDistance = Infinity;
        
        for (let i = 0; i < items.length; i++) {
            const cardWidth = this.getCardWidth(i, activeIndex);
            const cardCenter = position + cardWidth / 2;
            const distance = Math.abs(cardCenter - viewportCenter);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestIndex = i;
            }
            
            position += cardWidth + CARD_GAP;
        }
        
        // Clamp to bounds
        nearestIndex = Math.max(0, Math.min(items.length - 1, nearestIndex));
        
        this.goToCard(nearestIndex);
    };

    // === NAVIGATION ===
    goToCard = (index) => {
        const { items } = this.props;
        const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
        
        this.setState({ activeIndex: clampedIndex }, () => {
            this.updateTrackPosition(true);
        });
    };

    handlePrev = () => {
        const { activeIndex } = this.state;
        if (activeIndex > 0) {
            this.goToCard(activeIndex - 1);
        }
    };

    handleNext = () => {
        const { items } = this.props;
        const { activeIndex } = this.state;
        if (activeIndex < items.length - 1) {
            this.goToCard(activeIndex + 1);
        }
    };

    handleCardClick = (index) => {
        const { hasDragged } = this.state;
        if (!hasDragged) {
            this.goToCard(index);
        }
    };

    // === RENDERING ===
    renderCollapsedContent = (item) => {
        const { classes } = this.props;
        
        return (
            <div className={classes.collapsedContainer}>
                <div className={classes.collapsedImageWrapper}>
                    <img
                        src={item.image}
                        alt={item.name}
                        className={`${classes.collapsedImage} pixelated`}
                        draggable={false}
                    />
                    <div className={classes.collapsedGradient} />
                </div>
                <span className={classes.verticalLabel}>
                    {item.name}
                </span>
            </div>
        );
    };

    renderExpandedContent = (item, isExpanded) => {
        const { classes } = this.props;
        
        return (
            <div className={`${classes.expandedContainer} ${!isExpanded ? classes.expandedHidden : ''}`}>
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
        const { activeIndex, isAnimating } = this.state;

        return (
            <div className={classes.wrapper} ref={this.wrapperRef}>
                {/* Navigation Buttons */}
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
                {/* Carousel Track */}
                <div
                    ref={this.trackRef}
                    className={`${classes.track} ${isAnimating ? classes.trackAnimating : ''}`}
                    onMouseDown={this.handleMouseDown}
                >
                    {/* Left Spacer */}
                    <div 
                        className={classes.spacer} 
                        style={{ width: this.getSpacerWidth() }} 
                    />
                    
                    {items.map((item, index) => {
                        const distance = Math.abs(index - activeIndex);
                        const isExpanded = distance <= 1;
                        const isActive = distance === 0;
                        const width = this.getCardWidth(index);
                        const opacity = this.getCardOpacity(index);
                        
                        return (
                            <div
                                key={item.id || index}
                                className={`
                                    ${classes.card} 
                                    ${isActive ? classes.cardActive : ''} 
                                    ${!isActive ? classes.cardClickable : ''}
                                `}
                                style={{ width, opacity }}
                                onClick={() => this.handleCardClick(index)}
                            >
                                {isExpanded 
                                    ? this.renderExpandedContent(item, isExpanded)
                                    : this.renderCollapsedContent(item)
                                }
                            </div>
                        );
                    })}
                    
                    {/* Right Spacer */}
                    <div 
                        className={classes.spacer} 
                        style={{ width: this.getSpacerWidth() }} 
                    />
                </div>
                {/* Pagination Dots */}
                <div className={classes.pagination}>
                    {items.map((_, index) => (
                        <button
                            key={index}
                            className={`
                                ${classes.pageIndicator} 
                                ${index === activeIndex ? classes.pageIndicatorActive : ''}
                            `}
                            onClick={() => this.goToCard(index)}
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

export default withLanguage(withStyles(styles)(MD3ProgressiveCarousel));