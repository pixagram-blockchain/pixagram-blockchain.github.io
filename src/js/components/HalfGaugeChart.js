import * as React from "preact/compat";
import { useState, useRef, useEffect } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Typography from "@material-ui/core/Typography";
import Fade from "@material-ui/core/Fade";

import { T } from "../utils/T";
import { t, getLocaleCode } from "../utils/text";

const styles = theme => ({
    container: {
        position: "relative",
        width: "100%",
        height: "inherit",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0px",
    },
    svgContainer: {
        position: "relative",
        width: "100%",
        maxWidth: "min(600px, calc(100vw - 32px))",
        aspectRatio: "2 / 1",
        // Adjusted drop shadow to be subtler for the rounded shape
        filter: "drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.2))",
        overflow: "visible"
    },
    centerValue: {
        position: "absolute",
        top: "75%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        textAlign: "center",
        pointerEvents: "none",
        "& h3": {
            fontSize: "3rem",
            fontWeight: 400,
            margin: 0,
            lineHeight: 1,
            filter: "drop-shadow(0px 0px 32px white)",
            [theme.breakpoints.down("sm")]: {
                fontSize: "2.4rem",
            },
        },
        "& span": {
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "#999",
            marginBottom: 8,
            display: "block",
            fontFamily: '"Industry Book", "Normative Pro"',
            [theme.breakpoints.down("sm")]: {
                fontSize: "1rem",
            },
        },
    },
    // Signed net-delegation line under the big number: "+ X (usable due to
    // delegations)" when borrowed (delegated-in) stake exceeds lent
    // (delegated-out), "- X (unusable due to delegations)" the other way
    // round. Plain <p>/<b> on purpose — the centerValue "& span" rule above
    // styles the headline label (1.5rem, block, Industry Book) and would
    // hijack a nested <span>, so the monospace signed amount rides in a <b>.
    centerSecondary: {
        fontSize: "0.85rem",
        fontWeight: 400,
        color: "#999",
        margin: "8px 0 0 0",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        "& b": {
            color: "#cfcfcf",
            fontWeight: 600,
        },
        [theme.breakpoints.down("sm")]: {
            fontSize: "0.75rem",
        },
    },
    legend: {
        display: "flex",
        justifyContent: "center",
        gap: "16px",
        marginTop: "24px",
        flexWrap: "wrap",
        [theme.breakpoints.down("sm")]: {
            gap: "8px",
            marginTop: "24px",
        },
    },
    legendItem: {
        display: "flex",
        alignItems: "center",
        gap: "0px",
        cursor: "pointer",
        padding: "4px 12px",
        borderRadius: "24px",
        backgroundColor: "rgba(255, 255, 255, 0.02)",
        transition: "all 0.3s ease",
        "&:hover": {
            backgroundColor: "#1d1d1d",
            transform: "translateY(-2px)"
        },
        "&.active": {
            backgroundColor: "#1d1d1d",
        },
    },
    legendColor: {
        width: "16px",
        height: "16px",
        borderRadius: "50%", // Rounded indicators to match gauge
        marginRight: "8px"
    },
    legendText: {
        fontSize: "0.875rem",
        fontWeight: 400,
        "& span": {
            color: "#999",
            display: "block",
        },
    },
    tooltip: {
        position: "absolute",
        backgroundColor: "rgba(0, 0, 0, 1)",
        color: "#fff",
        padding: "12px 16px",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        pointerEvents: "none",
        zIndex: 9999,
        maxWidth: "240px",
        transition: "opacity 0.2s ease",
        "& h4": {
            margin: "0 0 8px 0",
            fontSize: "0.9rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "8px",
        },
        "& p": {
            margin: "4px 0",
            fontSize: "0.75rem",
            color: "#ccc",
        },
        "& .value": {
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "#fff",
            margin: "8px 0 4px 0",
        },
        "& .percentage": {
            fontSize: "0.875rem",
            color: "#888",
        },
    },
});

/**
 * Formats a numeric value with magnitude-dependent precision, then applies
 * locale grouping (thousands separators). Lifted verbatim from the inline
 * center-value expression:
 *   < 1   -> 3 decimals
 *   < 10  -> 2 decimals
 *   < 100 -> 1 decimal
 *   else  -> integer
 */
const formatValue = (value) => {
    const v = parseFloat(value);
    return Number(
        parseFloat(
            v < 1 ? v.toFixed(3)
                : v < 10 ? v.toFixed(2)
                    : v < 100 ? v.toFixed(1)
                        : parseInt(value)
        )
    ).toLocaleString(getLocaleCode());
};

const HalfGaugeChart = ({ classes, data, totalValue, delegationDeltaValue = 0, onSliceClick, currency = 'USD', fiatRate = 1 }) => {
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [activeIndex, setActiveIndex] = useState(null);
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, data: null });
    const svgRef = useRef(null);

    // Money labels (center total, legend, tooltip) arrive in USD; convert to the
    // user's display currency. ISO code, not symbol, to stay unambiguous. Slice
    // geometry and percentages use the raw values, so they're unaffected.
    const rate = Number.isFinite(Number(fiatRate)) && Number(fiatRate) > 0 ? Number(fiatRate) : 1;
    const cur = currency || 'USD';

    // Animated count-up for the center value. On every change of `totalValue`
    // it steps from 0 -> totalValue across exactly 34 text updates in ~1 second,
    // shaped by an ease-out cubic so the numbers move fast at first and glide to
    // a stop as they approach the total.
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        const target = parseFloat(totalValue) || 0;
        const totalFrames = 34;              // number of text changes
        const duration = 1000;               // total animation time (ms)
        const frameInterval = duration / totalFrames;

        // Ease-out cubic: 1 - (1 - t)^3. Fast start, decelerating to t = 1.
        const easeOut = (t) => 1 - Math.pow(1 - t, 3);

        let frame = 0;
        setDisplayValue(0);

        const id = setInterval(() => {
            frame += 1;
            const t = frame / totalFrames;       // linear time progress, 0 -> 1
            setDisplayValue(target * easeOut(t)); // eased value for this frame
            if (frame >= totalFrames) clearInterval(id); // 34th frame lands on target
        }, frameInterval);

        return () => clearInterval(id);
    }, [totalValue]);

    // Net delegation effect under the centre figure, supplied by the caller
    // as a signed USD value: positive = extra power usable thanks to
    // borrowed (delegated-in) stake, negative = owned stake currently
    // unusable because it is lent out. Hidden when it rounds to zero at
    // display precision. The absolute amount rides on the same eased
    // count-up as the main value (scaled by displayValue/total) so both
    // settle together; if the main total is zero while a delta exists (all
    // value is delegation-borrowed) it renders statically at its final value.
    const _mainTotal = parseFloat(totalValue) || 0;
    const _delegationDelta = parseFloat(delegationDeltaValue) || 0;
    const _deltaAbs = Math.abs(_delegationDelta);
    const showDelegationDelta = formatValue(_deltaAbs * rate) !== formatValue(0);
    const deltaDisplayAbs = _mainTotal > 0 ? _deltaAbs * (displayValue / _mainTotal) : _deltaAbs;

    // Configuration for the gauge dimensions
    const GAUGE_CONFIG = {
        cx: 200,
        cy: 200,
        outerRadius: 170, // Reduced slightly to fit rounded caps in viewbox
        innerRadius: 120,
    };

    // Calculate angles for each slice. Guard against an all-zero `total` —
    // (0/0)*180 = NaN in the path `d` attribute breaks SVG rendering entirely.
    // Caller normally substitutes equal sentinel weights for an empty wallet,
    // but defending in-depth here is cheap.
    const rawTotal = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    const total = rawTotal > 0 ? rawTotal : 1;
    let currentAngle = 180; // Start from left (180 degrees)

    const slices = data.map((item, index) => {
        const value = Number(item.value) || 0;
        const percentage = (value / total) * 100;
        const angleSpan = (value / total) * 180; // 180 degrees for half circle
        const startAngle = currentAngle;
        const endAngle = currentAngle + angleSpan;
        currentAngle = endAngle;

        return {
            ...item,
            percentage,
            startAngle,
            endAngle,
            index,
        };
    });

    // Slices are computed; no further mutation needed.

    /**
     * Creates an SVG path definition for a gauge segment.
     * * @param {number} startAngle - Starting angle in degrees
     * @param {number} endAngle - Ending angle in degrees
     * @param {number} innerRadius - Inner radius of the arc
     * @param {number} outerRadius - Outer radius of the arc
     * @param {boolean} isFirst - If true, rounds the start of the segment (Sausage left)
     * @param {boolean} isLast - If true, rounds the end of the segment (Sausage right)
     */
    const createArc = (startAngle, endAngle, innerRadius, outerRadius, isFirst, isLast) => {
        const cx = GAUGE_CONFIG.cx;
        const cy = GAUGE_CONFIG.cy;

        // Convert to radians
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        // Calculate main points
        const outerStart = {
            x: cx + outerRadius * Math.cos(startRad),
            y: cy + outerRadius * Math.sin(startRad)
        };
        const outerEnd = {
            x: cx + outerRadius * Math.cos(endRad),
            y: cy + outerRadius * Math.sin(endRad)
        };
        const innerStart = {
            x: cx + innerRadius * Math.cos(startRad),
            y: cy + innerRadius * Math.sin(startRad)
        };
        const innerEnd = {
            x: cx + innerRadius * Math.cos(endRad),
            y: cy + innerRadius * Math.sin(endRad)
        };

        // Determine Arc Flags
        const largeArc = endAngle - startAngle > 180 ? 1 : 0;

        // Calculate the radius for the rounded tips (half the thickness of the gauge)
        const thickness = outerRadius - innerRadius;
        const capRadius = thickness / 2;

        // 1. Move to Outer Start
        let path = `M ${outerStart.x} ${outerStart.y}`;

        // 2. Arc to Outer End (The main outer curve)
        path += ` A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`;

        // 3. Right Side Connection (End Cap)
        if (isLast) {
            // Rounded "Sausage" End: Draw a semi-circle from Outer End to Inner End
            // The sweep flag is 1 because we are rounding "outwards" relative to the cut
            path += ` A ${capRadius} ${capRadius} 0 0 1 ${innerEnd.x} ${innerEnd.y}`;
        } else {
            // Flat Line
            path += ` L ${innerEnd.x} ${innerEnd.y}`;
        }

        // 4. Arc to Inner Start (The main inner curve, drawn backwards)
        path += ` A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`;

        // 5. Left Side Connection (Start Cap)
        if (isFirst) {
            // Rounded "Sausage" Start: Draw a semi-circle from Inner Start to Outer Start
            path += ` A ${capRadius} ${capRadius} 0 0 1 ${outerStart.x} ${outerStart.y}`;
        } else {
            // Flat Line (This closes the shape automatically if we just Z, but explicit helps)
            path += ` L ${outerStart.x} ${outerStart.y}`;
        }

        path += " Z"; // Close path

        return path;
    };

    const handleMouseMove = (e, slice) => {
        setTooltip({
            visible: true,
            x: e.layerX,
            y: e.layerY,
            data: slice,
        });
    };

    const handleMouseLeave = () => {
        setHoveredIndex(null);
        setTooltip({ visible: false, x: 0, y: 0, data: null });
    };

    const handleClick = (slice) => {
        setActiveIndex(slice.index === activeIndex ? null : slice.index);
        if (onSliceClick) {
            onSliceClick(slice);
        }
    };

    const handleLegendClick = (slice) => {
        setActiveIndex(slice.index === activeIndex ? null : slice.index);
        if (onSliceClick) {
            onSliceClick(slice);
        }
    };

    return (
        <div className={classes.container}>
            <div className={classes.svgContainer}>
                {/* ViewBox adjusted to accommodate the rounded caps sticking out.
                   Original: 0 0 400 210
                   New: -20 0 440 230 to give breathing room for the sausage ends
                */}
                <svg
                    ref={svgRef}
                    viewBox="-20 -20 440 240"
                    style={{ width: "100%", height: "100%", overflow: "visible" }}
                >
                    {/* Base track - Drawn as one big sausage */}
                    <path
                        d={createArc(180, 360, GAUGE_CONFIG.innerRadius, GAUGE_CONFIG.outerRadius, true, true)}
                        fill="#ffffff"
                        opacity="0.1"
                    />

                    {/* Slices */}
                    {slices.map((slice, index) => {

                        const isHovered = hoveredIndex === index;
                        const isActive = activeIndex === index;

                        // Interaction Styles
                        const scale = isHovered || isActive ? 1.02 : 1;
                        // On hover/active, we slightly increase the outer radius for pop effect
                        const outerRadius = isActive || isHovered
                            ? GAUGE_CONFIG.outerRadius + 5
                            : GAUGE_CONFIG.outerRadius;
                        const innerRadius = GAUGE_CONFIG.innerRadius;

                        const opacity = isHovered || isActive ? 1 : 0.9;
                        const filter = isHovered || isActive
                            ? "drop-shadow(0px 0px 12px rgba(255,255,255,0.4))"
                            : "drop-shadow(0px 0px 0px transparent)";

                        // Determine if this slice should have rounded ends
                        const isFirst = index === 0;
                        const isLast = index === slices.length - 1;

                        return (
                            <g
                                key={index}
                                style={{
                                    cursor: "pointer",
                                    transformOrigin: `${GAUGE_CONFIG.cx}px ${GAUGE_CONFIG.cy}px`,
                                    transition: "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                                    transform: `scale(${scale})`,
                                }}
                                onMouseEnter={() => setHoveredIndex(index)}
                                onMouseMove={(e) => handleMouseMove(e, slice)}
                                onMouseLeave={handleMouseLeave}
                                onClick={() => handleClick(slice)}
                            >
                                <path
                                    style={{
                                        filter: filter,
                                        transition: "fill-opacity 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                                    }}
                                    d={createArc(
                                        slice.startAngle,
                                        slice.endAngle,
                                        innerRadius,
                                        outerRadius,
                                        isFirst, // Round the start if it's the first slice
                                        isLast   // Round the end if it's the last slice
                                    )}
                                    fill={slice.color}
                                    fillOpacity={opacity}
                                />
                            </g>
                        );
                    })}

                    {/* Labels on slices */}
                    {slices.map((slice, index) => {
                        // Position labels in the middle of the arc
                        const midAngle = ((slice.startAngle + slice.endAngle) / 2 * Math.PI) / 180;
                        // Place label exactly in the middle of the band width
                        const labelRadius = (GAUGE_CONFIG.innerRadius + GAUGE_CONFIG.outerRadius) / 2;

                        const x = GAUGE_CONFIG.cx + labelRadius * Math.cos(midAngle);
                        const y = GAUGE_CONFIG.cy + labelRadius * Math.sin(midAngle);

                        // Don't show label if slice is too small
                        if (slice.percentage < 5) return null;

                        return (
                            <g key={`label-${index}`} pointerEvents="none" style={{
                                opacity: hoveredIndex === index || activeIndex === index ? 1 : 0.7,
                                transition: "opacity 0.3s ease"
                            }}>
                                <text
                                    x={x}
                                    y={y}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill="rgba(0,0,0,0.8)"
                                    fontSize="13"
                                    fontWeight="700"
                                    className={"monospace"}
                                    style={{ textShadow: "0px 1px 2px rgba(255,255,255,0.5)" }}
                                >
                                    {slice.percentage.toFixed(0)}%
                                </text>
                            </g>
                        );
                    })}
                </svg>

                {/* Center value */}
                <div className={classes.centerValue}>
                    <Typography component="span">
                        {t("components.half_gauge_chart.total_wealth")}
                    </Typography>
                    <Typography component="h3" variant="h3" className={"monospace"}>
                        {formatValue(displayValue * rate)} {cur}
                    </Typography>
                    {showDelegationDelta && (
                        <p className={classes.centerSecondary}>
                            <T
                                k={_delegationDelta >= 0
                                    ? "components.half_gauge_chart.usable_due_to_delegations"
                                    : "components.half_gauge_chart.unusable_due_to_delegations"}
                                vars={{
                                    amount: formatValue(deltaDisplayAbs * rate),
                                    currency: cur
                                }}
                                slots={[<b className={"monospace"} key="0" />]} />
                        </p>
                    )}
                </div>
            </div>
            {/* Legend */}
            <div className={classes.legend}>
                {slices.map((slice, index) => (
                    <Fade in={true} timeout={500 + index * 100} key={`legend-${index}`}>
                        <div
                            className={`${classes.legendItem} ${hoveredIndex === index ? 'active' : ''}`}
                            onClick={() => handleLegendClick(slice)}
                            onMouseEnter={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        >
                            <div
                                className={classes.legendColor}
                                style={{ backgroundColor: slice.color }}
                            />
                            <div className={classes.legendText}>
                                <strong>{slice.name}</strong>
                                <span className={"monospace"}>{(slice.value * rate).toLocaleString(getLocaleCode())} {cur}</span>
                            </div>
                        </div>
                    </Fade>
                ))}
            </div>
            {/* Custom Tooltip */}
            {tooltip.visible && tooltip.data && (
                <div
                    className={classes.tooltip}
                    style={{
                        left: tooltip.x + 15,
                        top: tooltip.y + 15,
                        opacity: tooltip.visible ? 1 : 0,
                    }}
                >
                    <h4 style={{ color: tooltip.data.color }}>
                        {tooltip.data.name}
                    </h4>
                    <div className="value">{(tooltip.data.value * rate).toLocaleString(getLocaleCode())} {cur}</div>
                    <div className="percentage"><T
                        k="components.half_gauge_chart.0_0_of_total"
                        vars={{
                            percentage: tooltip.data.percentage.toFixed(2)
                        }}
                        slots={[<span className={"monospace"} key="0" />]} /></div>
                    {tooltip.data.description && (
                        <p>{tooltip.data.description}</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default withStyles(styles)(HalfGaugeChart);