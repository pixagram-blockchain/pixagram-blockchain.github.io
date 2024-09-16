import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
const styles = theme => ({
    // Carousel Container
    carouselWrapper: {
        position: 'relative',
        width: '100%',
        overflow: 'hidden',
        padding: '20px 0',
    },
    carouselTrack: {
        display: 'flex',
        gap: '12px',
        cursor: 'grab',
        userSelect: 'none',
        willChange: 'transform',
        paddingLeft: 'calc(50% - 140px)',
        paddingRight: 'calc(50% - 140px)',
        '&:active': {
            cursor: 'grabbing',
        },
    },
    
    // Card Base
    card: {
        flexShrink: 0,
        borderRadius: '24px',
        overflow: 'hidden',
        background: '#171717',
        transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms ease',
        position: 'relative',
        height: '380px',
    },
    
    // Card Size Variants
    cardSmall: {
        width: '64px',
        opacity: 0.6,
    },
    cardMedium: {
        width: '120px',
        opacity: 0.8,
    },
    cardLarge: {
        width: '280px',
        opacity: 1,
    },
    cardActive: {
        width: '320px',
        opacity: 1,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    },
    
    // Collapsed Card Content (Small/Medium)
    collapsedContent: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    collapsedImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        position: 'absolute',
        top: 0,
        left: 0,
        filter: 'brightness(0.7)',
    },
    verticalText: {
        writingMode: 'vertical-rl',
        textOrientation: 'mixed',
        transform: 'rotate(180deg)',
        fontSize: '14px',
        fontWeight: '600',
        color: '#ffffff',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        position: 'relative',
        zIndex: 2,
        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
        padding: '16px 0',
        maxHeight: 'calc(100% - 32px)',
        overflow: 'hidden',
    },
    
    // Expanded Card Content (Large/Active)
    expandedContent: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        boxSizing: 'border-box',
        opacity: 1,
        transition: 'opacity 300ms ease 100ms',
    },
    expandedContentHidden: {
        opacity: 0,
        transition: 'opacity 200ms ease',
        pointerEvents: 'none',
    },
    expandedImage: {
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        objectFit: 'cover',
        backgroundColor: '#101010',
        margin: '0 auto 16px',
        flexShrink: 0,
    },
    expandedName: {
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: '8px',
    },
    expandedRole: {
        fontSize: '14px',
        color: '#aaa',
        textAlign: 'center',
        marginBottom: '4px',
    },
    expandedCountry: {
        fontSize: '12px',
        color: '#666',
        textAlign: 'center',
        marginBottom: '16px',
    },
    expandedLink: {
        display: 'inline-block',
        margin: '0 auto',
        padding: '8px 16px',
        backgroundColor: 'rgba(255,255,255,0.08)',
        color: '#cccccc',
        borderRadius: '8px',
        textDecoration: 'none',
        fontSize: '12px',
        transition: 'all 300ms ease',
        '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: '#ffffff',
        },
    },
    
    // Navigation Dots
    dotsContainer: {
        display: 'flex',
        justifyContent: 'center',
        gap: '8px',
        marginTop: '20px',
    },
    dot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.2)',
        cursor: 'pointer',
        transition: 'all 300ms ease',
        '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.4)',
        },
    },
    dotActive: {
        width: '24px',
        borderRadius: '4px',
        backgroundColor: 'rgba(255,255,255,0.8)',
    },
    
    // Navigation Arrows
    navArrow: {
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.1)',
        border: 'none',
        color: '#ffffff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 300ms ease',
        zIndex: 10,
        backdropFilter: 'blur(8px)',
        '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.2)',
            transform: 'translateY(-50%) scale(1.1)',
        },
        '&:disabled': {
            opacity: 0.3,
            cursor: 'not-allowed',
            '&:hover': {
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(255,255,255,0.1)',
            },
        },
    },
    navArrowLeft: {
        left: '16px',
    },
    navArrowRight: {
        right: '16px',
    },
    arrowIcon: {
        width: '20px',
        height: '20px',
        fill: 'currentColor',
    },
});

class MD3Carousel extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            activeIndex: 0,
            isDragging: false,
            startX: 0,
            scrollLeft: 0,
            velocity: 0,
        };
        this.trackRef = React.createRef();
        this.animationFrame = null;
        this.lastX = 0;
        this.lastTime = 0;
    }

    componentDidMount() {
        this.centerOnCard(0, false);
        
        // Add touch event listeners with passive: false for preventDefault
        const track = this.trackRef.current;
        if (track) {
            track.addEventListener('touchstart', this.handleTouchStart, { passive: false });
            track.addEventListener('touchmove', this.handleTouchMove, { passive: false });
            track.addEventListener('touchend', this.handleTouchEnd, { passive: true });
        }
    }

    componentWillUnmount() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        const track = this.trackRef.current;
        if (track) {
            track.removeEventListener('touchstart', this.handleTouchStart);
            track.removeEventListener('touchmove', this.handleTouchMove);
            track.removeEventListener('touchend', this.handleTouchEnd);
        }
    }

    getCardWidth = (index) => {
        const { activeIndex } = this.state;
        const distance = Math.abs(index - activeIndex);
        
        if (distance === 0) return 320;      // Active
        if (distance === 1) return 280;      // Large
        if (distance === 2) return 120;      // Medium
        return 64;                            // Small
    };

    getCardClass = (index) => {
        const { classes } = this.props;
        const { activeIndex } = this.state;
        const distance = Math.abs(index - activeIndex);
        
        if (distance === 0) return classes.cardActive;
        if (distance === 1) return classes.cardLarge;
        if (distance === 2) return classes.cardMedium;
        return classes.cardSmall;
    };

    centerOnCard = (index, smooth = true) => {
        const track = this.trackRef.current;
        if (!track) return;

        const { items } = this.props;
        const gap = 12;
        
        // Calculate position to center the card
        let position = 0;
        for (let i = 0; i < index; i++) {
            position += this.getCardWidthForIndex(i, index) + gap;
        }
        
        // Add half of the active card width to center it
        position += this.getCardWidthForIndex(index, index) / 2;
        
        // Subtract half viewport width
        const viewportCenter = track.parentElement.offsetWidth / 2;
        const scrollTarget = position - viewportCenter + parseFloat(getComputedStyle(track).paddingLeft);

        if (smooth) {
            this.smoothScrollTo(scrollTarget);
        } else {
            track.style.transform = `translateX(${-scrollTarget}px)`;
        }
    };

    getCardWidthForIndex = (i, activeIndex) => {
        const distance = Math.abs(i - activeIndex);
        if (distance === 0) return 320;
        if (distance === 1) return 280;
        if (distance === 2) return 120;
        return 64;
    };

    smoothScrollTo = (target) => {
        const track = this.trackRef.current;
        if (!track) return;

        const current = this.getCurrentScroll();
        const diff = target - current;
        const duration = 400;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            
            track.style.transform = `translateX(${-(current + diff * eased)}px)`;

            if (progress < 1) {
                this.animationFrame = requestAnimationFrame(animate);
            }
        };

        this.animationFrame = requestAnimationFrame(animate);
    };

    getCurrentScroll = () => {
        const track = this.trackRef.current;
        if (!track) return 0;
        
        const transform = track.style.transform;
        const match = transform.match(/translateX\((-?\d+\.?\d*)px\)/);
        return match ? -parseFloat(match[1]) : 0;
    };

    handleMouseDown = (e) => {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        this.setState({
            isDragging: true,
            startX: e.pageX,
            scrollLeft: this.getCurrentScroll(),
        });
        this.lastX = e.pageX;
        this.lastTime = performance.now();
    };

    handleMouseMove = (e) => {
        const { isDragging, startX, scrollLeft } = this.state;
        if (!isDragging) return;

        e.preventDefault();
        const track = this.trackRef.current;
        if (!track) return;

        const x = e.pageX;
        const walk = startX - x;
        
        // Calculate velocity
        const now = performance.now();
        const dt = now - this.lastTime;
        if (dt > 0) {
            this.setState({ velocity: (this.lastX - x) / dt });
        }
        this.lastX = x;
        this.lastTime = now;

        track.style.transform = `translateX(${-(scrollLeft + walk)}px)`;
    };

    handleMouseUp = () => {
        const { isDragging, velocity } = this.state;
        if (!isDragging) return;

        this.setState({ isDragging: false });
        this.snapToNearestCard(velocity);
    };

    handleMouseLeave = () => {
        const { isDragging, velocity } = this.state;
        if (isDragging) {
            this.setState({ isDragging: false });
            this.snapToNearestCard(velocity);
        }
    };

    handleTouchStart = (e) => {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        const touch = e.touches[0];
        this.setState({
            isDragging: true,
            startX: touch.pageX,
            scrollLeft: this.getCurrentScroll(),
        });
        this.lastX = touch.pageX;
        this.lastTime = performance.now();
    };

    handleTouchMove = (e) => {
        const { isDragging, startX, scrollLeft } = this.state;
        if (!isDragging) return;

        e.preventDefault();
        const track = this.trackRef.current;
        if (!track) return;

        const touch = e.touches[0];
        const x = touch.pageX;
        const walk = startX - x;
        
        // Calculate velocity
        const now = performance.now();
        const dt = now - this.lastTime;
        if (dt > 0) {
            this.setState({ velocity: (this.lastX - x) / dt });
        }
        this.lastX = x;
        this.lastTime = now;

        track.style.transform = `translateX(${-(scrollLeft + walk)}px)`;
    };

    handleTouchEnd = () => {
        const { isDragging, velocity } = this.state;
        if (!isDragging) return;

        this.setState({ isDragging: false });
        this.snapToNearestCard(velocity);
    };

    snapToNearestCard = (velocity = 0) => {
        const { items } = this.props;
        const { activeIndex } = this.state;
        const currentScroll = this.getCurrentScroll();
        
        // Apply momentum
        const momentum = velocity * 150;
        const targetScroll = currentScroll + momentum;
        
        // Find nearest card
        const gap = 12;
        let position = 0;
        let nearestIndex = 0;
        let minDistance = Infinity;

        for (let i = 0; i < items.length; i++) {
            const cardCenter = position + this.getCardWidthForIndex(i, activeIndex) / 2;
            const viewportCenter = targetScroll + this.trackRef.current.parentElement.offsetWidth / 2 - parseFloat(getComputedStyle(this.trackRef.current).paddingLeft);
            const distance = Math.abs(cardCenter - viewportCenter);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestIndex = i;
            }
            
            position += this.getCardWidthForIndex(i, activeIndex) + gap;
        }

        // Clamp to valid range
        nearestIndex = Math.max(0, Math.min(items.length - 1, nearestIndex));
        
        this.setState({ activeIndex: nearestIndex }, () => {
            this.centerOnCard(nearestIndex);
        });
    };

    goToCard = (index) => {
        const { items } = this.props;
        const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
        
        this.setState({ activeIndex: clampedIndex }, () => {
            this.centerOnCard(clampedIndex);
        });
    };

    goToPrev = () => {
        const { activeIndex } = this.state;
        if (activeIndex > 0) {
            this.goToCard(activeIndex - 1);
        }
    };

    goToNext = () => {
        const { items } = this.props;
        const { activeIndex } = this.state;
        if (activeIndex < items.length - 1) {
            this.goToCard(activeIndex + 1);
        }
    };

    renderCollapsedContent = (item) => {
        const { classes } = this.props;
        
        return (
            <div className={classes.collapsedContent}>
                <img 
                    src={item.image} 
                    alt={item.name}
                    className={`${classes.collapsedImage} pixelated`}
                />
                <span className={classes.verticalText}>
                    {item.name}
                </span>
            </div>
        );
    };

    renderExpandedContent = (item, isExpanded) => {
        const { classes } = this.props;
        
        return (
            <div className={`${classes.expandedContent} ${!isExpanded ? classes.expandedContentHidden : ''}`}>
                <img 
                    src={item.image} 
                    alt={item.name}
                    className={`${classes.expandedImage} pixelated`}
                />
                <div className={classes.expandedName}>{item.name}</div>
                <div className={classes.expandedRole}>{item.role}</div>
                <div className={classes.expandedCountry}>{item.country}</div>
                <a
                    href={item.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={classes.expandedLink}
                >
                    {t("words.view_linkedin")}
                </a>
            </div>
        );
    };

    render() {
        const { classes, items } = this.props;
        const { activeIndex, isDragging } = this.state;

        return (
            <div className={classes.carouselWrapper}>
                {/* Left Arrow */}
                <button
                    className={`${classes.navArrow} ${classes.navArrowLeft}`}
                    onClick={this.goToPrev}
                    disabled={activeIndex === 0}
                    aria-label={t("words.previous")}
                >
                    <svg className={classes.arrowIcon} viewBox="0 0 24 24">
                        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                    </svg>
                </button>
                {/* Right Arrow */}
                <button
                    className={`${classes.navArrow} ${classes.navArrowRight}`}
                    onClick={this.goToNext}
                    disabled={activeIndex === items.length - 1}
                    aria-label={t("words.next")}
                >
                    <svg className={classes.arrowIcon} viewBox="0 0 24 24">
                        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                    </svg>
                </button>
                {/* Carousel Track */}
                <div
                    ref={this.trackRef}
                    className={classes.carouselTrack}
                    onMouseDown={this.handleMouseDown}
                    onMouseMove={this.handleMouseMove}
                    onMouseUp={this.handleMouseUp}
                    onMouseLeave={this.handleMouseLeave}
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                >
                    {items.map((item, index) => {
                        const distance = Math.abs(index - activeIndex);
                        const isExpanded = distance <= 1;
                        
                        return (
                            <div
                                key={index}
                                className={`${classes.card} ${this.getCardClass(index)}`}
                                onClick={() => !isDragging && this.goToCard(index)}
                                style={{
                                    width: this.getCardWidth(index),
                                }}
                            >
                                {isExpanded 
                                    ? this.renderExpandedContent(item, isExpanded)
                                    : this.renderCollapsedContent(item)
                                }
                            </div>
                        );
                    })}
                </div>
                {/* Navigation Dots */}
                <div className={classes.dotsContainer}>
                    {items.map((_, index) => (
                        <button
                            key={index}
                            className={`${classes.dot} ${index === activeIndex ? classes.dotActive : ''}`}
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

export default withLanguage(withStyles(styles)(MD3Carousel));