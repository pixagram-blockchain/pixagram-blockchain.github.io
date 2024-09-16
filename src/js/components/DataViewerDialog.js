import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import CloseIcon from "@material-ui/icons/Close";
import UnfoldMoreIcon from "@material-ui/icons/UnfoldMore";
import UnfoldLessIcon from "@material-ui/icons/UnfoldLess";
import RefreshIcon from "@material-ui/icons/Refresh";
import OpenInNewIcon from "@material-ui/icons/OpenInNew";

import { inspectImageDataUri } from "../utils/api/sanitizer";

import { T } from "../utils/T";
import { t, getLocaleCode, useLanguage } from "../utils/text";

const { memo, useCallback, useMemo, useState, useEffect, useRef } = React;

// ─── Type Detection ────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const BASE64_DATA_URI_RE = /^data:[^;]+;base64,/;
const PURE_BASE64_RE = /^[A-Za-z0-9+/]{20,}={0,2}$/;

function detectStringSubtype(val) {
    if (BASE64_DATA_URI_RE.test(val)) return "BASE64_URI";
    if (PURE_BASE64_RE.test(val) && val.length > 40) return "BASE64";
    if (ISO_DATE_RE.test(val)) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return "DATE";
    }
    try {
        const parsed = JSON.parse(val);
        if (typeof parsed === "object" && parsed !== null) return "JSON";
    } catch {}
    return null;
}

function detectNumberSubtype(val) {
    if (val > 978307200 && val < 2208988800) return "DATE_UNIX_S";
    if (val > 978307200000 && val < 2208988800000) return "DATE_UNIX_MS";
    return null;
}

function getType(val) {
    if (val === null) return "null";
    if (val === undefined) return "undefined";
    if (Array.isArray(val)) return "array";
    return typeof val;
}

// ─── Responsive Hook ───────────────────────────────────────────
//
// Tracks whether the viewport is below the mobile breakpoint. The split
// pane layout (tree + detail side-by-side) collapses below this width;
// detail moves into a bottom swipeable drawer instead.
const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window === "undefined") return false;
        return window.innerWidth < MOBILE_BREAKPOINT;
    });
    useEffect(() => {
        if (typeof window === "undefined") return;
        const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);
    return isMobile;
}

// ─── Tree Node Builder ─────────────────────────────────────────

let _nodeId = 0;

function buildTree(key, value, parentPath = "") {
    const id = String(++_nodeId);
    const path = parentPath ? `${parentPath}.${key}` : String(key);
    const type = getType(value);
    const node = { id, key: String(key), path, type, value, subtype: null, parsed: false, children: [] };

    if (type === "string") {
        const sub = detectStringSubtype(value);
        node.subtype = sub;
        if (sub === "JSON") {
            node.parsed = true;
            node.parsedValue = JSON.parse(value);
            const entries = Array.isArray(node.parsedValue)
                ? node.parsedValue.map((v, i) => [i, v])
                : Object.entries(node.parsedValue);
            node.children = entries.map(([k, v]) => buildTree(k, v, path));
        }
    } else if (type === "number") {
        node.subtype = detectNumberSubtype(value);
    } else if (type === "object") {
        node.children = Object.entries(value).map(([k, v]) => buildTree(k, v, path));
    } else if (type === "array") {
        node.children = value.map((v, i) => buildTree(i, v, path));
    }

    return node;
}

// ─── URL Builder ───────────────────────────────────────────────
//
// Pixagram routes posts as `/{category}/@{author}/{permlink}` (mirroring
// the HIVE/STEEM convention). `category` may be either a plain tag
// ("retro") or a community ID ("hive-129948"); both forms work as the
// first path segment. Falls back to "feed" if category is missing.
//
// `author` may be either a string (raw chain payload) or an object
// with `.username` (sanitized entity shape).
function buildPostUrl(rawData) {
    if (!rawData || typeof rawData !== "object") return null;
    const authorField = rawData.author;
    const author = typeof authorField === "string"
        ? authorField
        : (authorField && typeof authorField === "object" ? authorField.username : null);
    const permlink = rawData.permlink;
    const category = rawData.category;
    if (!author || !permlink) return null;
    const origin = (typeof window !== "undefined" && window.location && window.location.origin)
        ? window.location.origin
        : "";
    const cat = category && String(category).length ? String(category) : "feed";
    return `${origin}/${cat}/@${author}/${permlink}`;
}

// ─── Type Icons (greyscale SVG) ────────────────────────────────

const TYPE_GLYPHS = {
    string:    { glyph: "S",  stroke: "#999" },
    number:    { glyph: "#",  stroke: "#aaa" },
    boolean:   { glyph: "B",  stroke: "#888" },
    object:    { glyph: "{",  stroke: "#bbb" },
    array:     { glyph: "[",  stroke: "#bbb" },
    null:      { glyph: "∅",  stroke: "#555" },
    undefined: { glyph: "?",  stroke: "#555" },
};

const TypeGlyph = ({ type }) => {
    const g = TYPE_GLYPHS[type] || TYPE_GLYPHS.string;
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: .75 }}>
            <rect x="1" y="2" width="14" height="12" rx="2" fill={"#ffffff"} />
            <text x="8" y="11.2" textAnchor="middle" fill={"#000000"} fontSize="8" fontWeight="700"
                  fontFamily="'Geist Mono', monospace">{g.glyph}</text>
        </svg>
    );
};

// ─── Subtype / Parsed Badges ───────────────────────────────────

const BADGE_STYLES = {
    JSON:        { bg: "#ffffff1a", fg: "#ffffffa8" },
    DATE:        { bg: "#ffffff1a", fg: "#ffffffa8" },
    DATE_UNIX_S: { bg: "#ffffff1a", fg: "#ffffffa8" },
    DATE_UNIX_MS:{ bg: "#ffffff1a", fg: "#ffffffa8" },
    BASE64:      { bg: "#ffffff1a", fg: "#ffffffa8" },
    BASE64_URI:  { bg: "#ffffff1a", fg: "#ffffffa8" },
};

const Badge = ({ label, style: s }) => (
    <span style={{
        fontSize: 9, fontWeight: 600, letterSpacing: "0.06em",
        padding: "1px 5px", borderRadius: 9,
        background: s.bg, color: s.fg,
        marginLeft: 5, textTransform: "uppercase",
        fontFamily: sansFont,
    }}>
        {label}
    </span>
);

const SubtypeBadge = ({ subtype }) => {
    if (!subtype) return null;
    const s = BADGE_STYLES[subtype] || { bg: "#1e1e1e", fg: "#777" };
    return <Badge label={subtype.replace(/_/g, " ")} style={s} />;
};

const ParsedBadge = ({ parsed }) => {
    if (!parsed) return null;
    return <Badge label="PARSED" style={{ bg: "#1a1a1a", fg: "#999" }} />;
};

// ─── Chevron ───────────────────────────────────────────────────

const Chevron = ({ open }) => (
    <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 18, height: 18, flexShrink: 0,
        transition: "transform 0.15s ease",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
    }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M3 1.5L7 5L3 8.5" stroke="#666" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    </span>
);

// ─── Preview Text ──────────────────────────────────────────────

function getPreview(node) {
    if (node.type === "object") return `{ ${node.children.length} }`;
    if (node.type === "array") return `[ ${node.children.length} ]`;
    if (node.type === "string" && node.subtype === "JSON") return "{ parsed }";
    if (node.type === "string" && (node.subtype === "BASE64" || node.subtype === "BASE64_URI"))
        return `[${node.value.length} chars]`;
    if (node.type === "string" && node.subtype === "DATE") return new Date(node.value).toLocaleString(getLocaleCode());
    if (node.type === "number" && node.subtype === "DATE_UNIX_S") return new Date(node.value * 1000).toLocaleString(getLocaleCode());
    if (node.type === "number" && node.subtype === "DATE_UNIX_MS") return new Date(node.value).toLocaleString(getLocaleCode());
    if (node.type === "boolean") return String(node.value);
    if (node.type === "null") return "null";
    if (node.type === "undefined") return "undefined";
    if (node.type === "string") {
        return node.value.length > 32 ? `"${node.value.slice(0, 32)}…"` : `"${node.value}"`;
    }
    return String(node.value);
}

// ─── Tree Node ─────────────────────────────────────────────────

const TreeNode = React.memo(({ node, depth, selectedId, onSelect, expanded, onToggle }) => {
    useLanguage();
    const hasChildren = node.children && node.children.length > 0;
    const isOpen = expanded.has(node.id);
    const isSelected = selectedId === node.id;

    // Two separate click intents on a row:
    //   • Chevron area  → toggle expand/collapse only. Critically, this
    //     must NOT call onSelect — on mobile, onSelect opens the bottom
    //     drawer, and we don't want every parent-expansion to yank the
    //     drawer up over the tree.
    //   • Rest of row   → select the node (which on mobile opens the
    //     drawer). Leaf rows have no chevron, so the whole row selects.
    const handleSelect = useCallback((e) => {
        e.stopPropagation();
        onSelect(node.id);
    }, [node.id, onSelect]);

    const handleToggle = useCallback((e) => {
        e.stopPropagation();
        if (hasChildren) onToggle(node.id);
    }, [node.id, hasChildren, onToggle]);

    const preview = useMemo(() => getPreview(node), [node]);

    return (
        <div>
            <div
                onClick={handleSelect}
                style={{
                    display: "flex", alignItems: "center", gap: 4,
                    paddingLeft: depth * 18 + 6, paddingRight: 8,
                    height: 28, cursor: "pointer",
                    background: isSelected ? "#202020" : "transparent",
                    transition: "background 0.1s ease",
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#181818"; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
            >
                {hasChildren
                    ? (
                        <span
                            onClick={handleToggle}
                            // Slightly enlarged tap target around the
                            // chevron — 18px glyph is too small for a
                            // reliable finger tap, especially nested.
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "-4px 0 -4px -4px",
                                padding: "4px 2px 4px 4px",
                                cursor: "pointer",
                                flexShrink: 0,
                            }}
                        >
                            <Chevron open={isOpen} />
                        </span>
                    )
                    : <span style={{ width: 18, flexShrink: 0 }} />
                }
                <TypeGlyph type={node.type} />
                <span style={{
                    fontFamily: "'Industry Book', 'Normative Pro', sans-serif",
                    fontSize: 12, fontWeight: 500, color: "#ddd",
                    whiteSpace: "nowrap", marginRight: 3,
                }}>
                    {node.key}
                </span>
                <SubtypeBadge subtype={node.subtype} />
                <ParsedBadge parsed={node.parsed} />
                <span style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 11, color: "#666", whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis", marginLeft: "auto",
                }}>
                    {preview}
                </span>
            </div>
            {hasChildren && isOpen && node.children.map(child => (
                <TreeNode
                    key={child.id}
                    node={child}
                    depth={depth + 1}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    expanded={expanded}
                    onToggle={onToggle}
                />
            ))}
        </div>
    );
});
TreeNode.displayName = "TreeNode";

// ─── Bottom Drawer (mobile detail pane) ────────────────────────
//
// A swipeable bottom sheet used in mobile layout to host the DetailPane.
// Implements:
//   • slide-up entrance / slide-down exit
//   • drag-to-dismiss with velocity threshold (touch + mouse)
//   • backdrop tap to close
//   • body-scroll locking while open
//   • handle bar affordance at top
//
// The drawer is rendered into the same DOM subtree as the Dialog (no
// portal) so it inherits Dialog's z-index stacking; we use position:fixed
// inside the dialog paper to overlay the tree pane.
const DRAWER_DISMISS_VELOCITY = 0.6; // px/ms — flick threshold
const DRAWER_DISMISS_DISTANCE = 0.35; // fraction of drawer height

const BottomDrawer = React.memo(({ open, onClose, children, peekHeight = "85vh" }) => {
    useLanguage();
    const [mounted, setMounted] = useState(open);
    const [animating, setAnimating] = useState(false);
    const [dragY, setDragY] = useState(0);
    const dragStateRef = useRef(null);
    const sheetRef = useRef(null);

    // Mount/unmount with animation pass. We keep the node mounted briefly
    // after `open` flips to false so the slide-down can play out.
    useEffect(() => {
        if (open) {
            setMounted(true);
            // Next frame: trigger enter animation.
            requestAnimationFrame(() => {
                setAnimating(true);
            });
        } else if (mounted) {
            setAnimating(false);
            const t = setTimeout(() => setMounted(false), 240);
            return () => clearTimeout(t);
        }
    }, [open, mounted]);

    // Lock body scroll while open.
    useEffect(() => {
        if (!mounted) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
    }, [mounted]);

    // Drag handlers — work for both touch and mouse.
    const onDragStart = useCallback((clientY) => {
        dragStateRef.current = {
            startY: clientY,
            startTime: Date.now(),
            lastY: clientY,
            lastTime: Date.now(),
        };
    }, []);

    const onDragMove = useCallback((clientY) => {
        const s = dragStateRef.current;
        if (!s) return;
        const delta = clientY - s.startY;
        // Only allow downward drag (resist upward).
        const constrained = delta < 0 ? delta * 0.2 : delta;
        s.lastY = clientY;
        s.lastTime = Date.now();
        setDragY(constrained);
    }, []);

    const onDragEnd = useCallback(() => {
        const s = dragStateRef.current;
        if (!s) return;
        const sheetH = sheetRef.current?.offsetHeight || 1;
        const distance = s.lastY - s.startY;
        const elapsed = Math.max(1, s.lastTime - s.startTime);
        const velocity = distance / elapsed;
        dragStateRef.current = null;

        const shouldClose =
            velocity > DRAWER_DISMISS_VELOCITY ||
            distance > sheetH * DRAWER_DISMISS_DISTANCE;

        if (shouldClose) {
            setDragY(0);
            onClose();
        } else {
            // Snap back.
            setDragY(0);
        }
    }, [onClose]);

    // Touch handlers
    const onTouchStart = useCallback((e) => onDragStart(e.touches[0].clientY), [onDragStart]);
    const onTouchMove = useCallback((e) => onDragMove(e.touches[0].clientY), [onDragMove]);
    const onTouchEnd = useCallback(() => onDragEnd(), [onDragEnd]);

    // Mouse handlers (for desktop testing — the drawer only shows on
    // mobile in production but mouse drag is a nice-to-have).
    const onMouseDown = useCallback((e) => {
        onDragStart(e.clientY);
        const move = (ev) => onDragMove(ev.clientY);
        const up = () => {
            onDragEnd();
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
    }, [onDragStart, onDragMove, onDragEnd]);

    if (!mounted) return null;

    const visible = animating && open;
    const translateY = visible ? `${dragY}px` : "100%";
    // While dragging we suppress the transition so the sheet tracks the
    // finger 1:1; on release it animates back into place.
    const isDragging = dragStateRef.current !== null;
    const transition = isDragging ? "none" : "transform 0.24s cubic-bezier(0.32, 0.72, 0, 1)";

    // Backdrop opacity fades with drag distance to reinforce dismissal.
    const sheetH = sheetRef.current?.offsetHeight || 1;
    const dragProgress = Math.min(1, Math.max(0, dragY / sheetH));
    const backdropOpacity = visible ? (1 - dragProgress) * 0.55 : 0;

    return (
        <div style={{
            position: "absolute", inset: 0, zIndex: 10,
            pointerEvents: visible ? "auto" : "none",
        }}>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: "absolute", inset: 0,
                    background: "#000",
                    opacity: backdropOpacity,
                    transition: isDragging ? "none" : "opacity 0.24s ease",
                }}
            />
            {/* Sheet */}
            <div
                ref={sheetRef}
                style={{
                    position: "absolute", left: 0, right: 0, bottom: 0,
                    maxHeight: peekHeight,
                    height: peekHeight,
                    background: "#0d0d0d",
                    borderTopLeftRadius: 18,
                    borderTopRightRadius: 18,
                    boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
                    transform: `translateY(${translateY})`,
                    transition,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                {/* Drag handle */}
                <div
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    onMouseDown={onMouseDown}
                    style={{
                        padding: "10px 0 6px 0",
                        display: "flex",
                        justifyContent: "center",
                        cursor: "grab",
                        flexShrink: 0,
                        touchAction: "none",
                    }}
                >
                    <div style={{
                        width: 40, height: 4,
                        background: "#333",
                        borderRadius: 2,
                    }} />
                </div>
                {/* Content scroll area */}
                <div style={{
                    flex: 1,
                    overflow: "auto",
                    WebkitOverflowScrolling: "touch",
                }}>
                    {children}
                </div>
            </div>
        </div>
    );
});
BottomDrawer.displayName = "BottomDrawer";

// ─── Detail Pane ───────────────────────────────────────────────

function findNode(root, id) {
    if (root.id === id) return root;
    for (const c of root.children || []) {
        const found = findNode(c, id);
        if (found) return found;
    }
    return null;
}

const mono = "'Geist Mono', monospace";
const sansFont = "'Industry Book', 'Normative Pro', sans-serif";
const codeBlock = {
    background: "#161616", borderRadius: 12, padding: "8px 10px",
    maxHeight: 200, overflow: "auto",
    fontSize: 11.5, fontFamily: mono, wordBreak: "break-all",
    lineHeight: 1.6, whiteSpace: "pre-wrap", color: "#999",
};
const metaCard = {
    background: "#161616", borderRadius: 12, padding: "6px 10px",
    minWidth: 140,
};
const metaLabel = {
    fontSize: 9, color: "#666", textTransform: "uppercase",
    letterSpacing: "0.08em", marginBottom: 2, fontFamily: sansFont,
};
const metaValue = { fontSize: 12.5, color: "#ccc", fontFamily: mono, wordBreak: "break-all" };

const DateDetail = ({ value, source }) => {
    const d = new Date(value);
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                    ["ISO 8601", d.toISOString()],
                    ["Local", d.toLocaleString(getLocaleCode())],
                    ["UTC", d.toUTCString()],
                    ["Timestamp (s)", Math.floor(d.getTime() / 1000)],
                    ["Timestamp (ms)", d.getTime()],
                ].map(([label, val]) => (
                    <div key={label} style={metaCard}>
                        <div style={metaLabel}>{label}</div>
                        <div style={metaValue}>{String(val)}</div>
                    </div>
                ))}
            </div>
            <div style={{ fontSize: 10, color: "#555", fontStyle: "italic", fontFamily: sansFont }}>{t("components.data_viewer_dialog.source_detected_and_parsed_as_date", {
                source: source
            })}</div>
        </div>
    );
};

const Base64Detail = ({ value, subtype }) => {
    const isDataUri = subtype === "BASE64_URI";
    const declaredMatch = isDataUri ? value.match(/^data:([^;]+);/) : null;
    const declared = declaredMatch ? declaredMatch[1] : null;
    const rawB64 = isDataUri ? value.split(",")[1] : value;
    const byteSize = Math.ceil((rawB64?.length || 0) * 3 / 4);

    // This dialog renders raw on-chain JSON metadata, which anyone can write
    // anything into. The MIME type in the data URI is the attacker's claim
    // about their own bytes, so it decides nothing — the validator decodes,
    // sniffs the real format and inspects it. A preview only renders on a
    // clean verdict.
    const verdict = useMemo(
        () => (declared && declared.startsWith("image/") ? inspectImageDataUri(value) : null),
        [value, declared],
    );

    const sniffed = verdict && verdict.mime;
    const mismatched = Boolean(sniffed && declared && sniffed !== declared);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {isDataUri && declared && (
                    <div style={metaCard}>
                        <div style={metaLabel}>{mismatched ? "MIME (declared)" : "MIME"}</div>
                        <div style={{ ...metaValue, color: mismatched ? "#e5a13c" : metaValue.color }}>{declared}</div>
                    </div>
                )}
                {mismatched && (
                    <div style={metaCard}>
                        <div style={metaLabel}>MIME (actual)</div>
                        <div style={{ ...metaValue, color: "#e5a13c" }}>{sniffed}</div>
                    </div>
                )}
                <div style={metaCard}>
                    <div style={metaLabel}>{t("components.data_viewer_dialog.encoded_length")}</div>
                    <div style={metaValue}>{value.length.toLocaleString(getLocaleCode())} chars</div>
                </div>
                <div style={metaCard}>
                    <div style={metaLabel}>{t("components.data_viewer_dialog.decoded_size")}</div>
                    <div style={metaValue}>~{(byteSize / 1024).toFixed(1)} KB</div>
                </div>
                {verdict && verdict.width > 0 && (
                    <div style={metaCard}>
                        <div style={metaLabel}>{t("components.data_viewer_dialog.dimensions")}</div>
                        <div style={metaValue}>{verdict.width} × {verdict.height}</div>
                    </div>
                )}
            </div>

            {verdict && verdict.ok && (
                <div style={{ background: "#141414", borderRadius: 12, padding: 12 }}>
                    <div style={metaLabel}>{t("components.data_viewer_dialog.preview")}</div>
                    <img
                        src={value}
                        alt="preview"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        style={{ maxWidth: "100%", borderRadius: 9, display: "block", marginTop: 6 }}
                    />
                </div>
            )}

            {verdict && !verdict.ok && (
                <div style={{
                    background: "#1a1210", border: "1px solid #4a2b20",
                    borderRadius: 12, padding: 12,
                }}>
                    <div style={{ ...metaLabel, color: "#e5a13c" }}>
                        {t("components.data_viewer_dialog.preview_blocked")}
                    </div>
                    <div style={{
                        fontSize: 11, color: "#c98f4a", fontFamily: mono, marginTop: 6,
                        wordBreak: "break-all",
                    }}>
                        {verdict.reason}
                    </div>
                    <div style={{
                        fontSize: 10, color: "#7a5f45", fontFamily: sansFont,
                        fontStyle: "italic", marginTop: 6,
                    }}>
                        {t("components.data_viewer_dialog.preview_blocked_hint")}
                    </div>
                </div>
            )}

            <div style={{ ...codeBlock, maxHeight: 320 }}>
                {value.slice(0, 72000)}{value.length > 72000 ? "…" : ""}
            </div>
        </div>
    );
};

const DetailPane = ({ node }) => {
    if (!node) {
        return (
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                height: "100%", color: "#333", fontFamily: sansFont, fontSize: 12,
                fontStyle: "italic",
            }}>
                {t("components.data_viewer_dialog.select_a_node_to_inspect")}
            </div>
        );
    }

    const renderValue = () => {
        // Date from string
        if (node.type === "string" && node.subtype === "DATE")
            return <DateDetail value={node.value} source="ISO 8601 string" />;

        // Date from number
        if (node.type === "number" && (node.subtype === "DATE_UNIX_S" || node.subtype === "DATE_UNIX_MS")) {
            const ms = node.subtype === "DATE_UNIX_S" ? node.value * 1000 : node.value;
            return <DateDetail value={ms} source={node.subtype === "DATE_UNIX_S" ? "Unix timestamp (seconds)" : "Unix timestamp (milliseconds)"} />;
        }

        // Base64
        if (node.type === "string" && (node.subtype === "BASE64" || node.subtype === "BASE64_URI"))
            return <Base64Detail value={node.value} subtype={node.subtype} />;

        // JSON parsed
        if (node.type === "string" && node.subtype === "JSON") {
            return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{
                        display: "flex", alignItems: "center", gap: 6,
                        background: "#181818", borderRadius: 12, padding: "6px 10px",
                        fontSize: 11, color: "#888", fontFamily: sansFont,
                    }}><T
                        k="components.data_viewer_dialog.0_0_this_string_value_was_parsed"
                        slots={[<span style={{ color: "#999" }} key="0" />]} /></div>
                    <div style={{ fontSize: 10, color: "#555", fontFamily: sansFont }}>{t("components.data_viewer_dialog.original_string_length_characters", {
                        value_count: node.value.length.toLocaleString(getLocaleCode())
                    })}</div>
                    <div style={codeBlock}>
                        {JSON.stringify(node.parsedValue, null, 2)}
                    </div>
                </div>
            );
        }

        // Object / Array summary
        if (node.type === "object" || node.type === "array") {
            const typeSummary = {};
            node.children.forEach(c => {
                const t = c.subtype ? `${c.type}:${c.subtype}` : c.type;
                typeSummary[t] = (typeSummary[t] || 0) + 1;
            });
            return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={metaCard}>
                        <div style={metaLabel}>{node.type === "array" ? "Array length" : "Object keys"}</div>
                        <div style={{ fontSize: 18, color: "#ccc", fontFamily: mono, fontWeight: 600 }}>
                            {node.children.length}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {Object.entries(typeSummary).map(([t, c]) => (
                            <div key={t} style={{
                                background: "#161616", borderRadius: 12, padding: "4px 8px",
                                fontSize: 11, fontFamily: sansFont,
                            }}>
                                <span style={{ color: "#555" }}>{c}× </span>
                                <span style={{ color: "#bbb" }}>{t}</span>
                            </div>
                        ))}
                    </div>
                    {node.type === "object" && (
                        <div style={{ ...codeBlock, color: "#555" }}>
                            Keys: {node.children.map(c => c.key).join(", ")}
                        </div>
                    )}
                </div>
            );
        }

        // Plain value
        return (
            <div style={{ ...codeBlock, color: "#bbb" }}>
                {node.type === "string" ? `"${node.value}"` : String(node.value)}
            </div>
        );
    };

    return (
        <div style={{ padding: "12px 14px", fontFamily: sansFont }}>
            {/* Header */}
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <TypeGlyph type={node.type} />
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#ddd", fontFamily: sansFont }}>{node.key}</span>
                    <SubtypeBadge subtype={node.subtype} />
                    <ParsedBadge parsed={node.parsed} />
                </div>
                <div style={{ fontSize: 10, color: "#444", wordBreak: "break-all", fontFamily: mono }}>{node.path}</div>
            </div>
            {/* Meta */}
            <div style={{
                display: "flex", gap: 12, marginBottom: 12, fontSize: 10, color: "#555",
                borderBottom: "1px solid #1a1a1a", paddingBottom: 8, fontFamily: sansFont,
            }}>
                <span>{t("components.data_viewer_dialog.type")} <span style={{ color: "#999" }}>{node.type}</span></span>
                {node.subtype && <span>{t("components.data_viewer_dialog.subtype")} <span style={{ color: "#999" }}>{node.subtype}</span></span>}
                {node.parsed && <span style={{ color: "#888" }}>{t("components.data_viewer_dialog.originally_a_string_parsed_for_inspection")}</span>}
            </div>
            {renderValue()}
        </div>
    );
};

// ─── URL Bar ───────────────────────────────────────────────────

const UrlBar = React.memo(({ url }) => {
    useLanguage();
    const [copied, setCopied] = useState(false);
    const handleCopy = useCallback((e) => {
        e.stopPropagation();
        if (!url) return;
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
            }).catch(() => {});
        }
    }, [url]);
    if (!url) return null;
    return (
        <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 16px",
            background: "#0a0a0a",
            borderBottom: "1px solid #1a1a1a",
            fontFamily: mono,
            fontSize: 11,
            flexShrink: 0,
        }}>
            <span style={{ color: "#555", textTransform: "uppercase", letterSpacing: "0.08em",
                fontFamily: sansFont, fontSize: 9, fontWeight: 600 }}>
                URL
            </span>
            <span
                onClick={handleCopy}
                title={t("components.data_viewer_dialog.click_to_copy")}
                style={{
                    flex: 1, color: "#999", overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap", cursor: "pointer",
                }}
            >
                {url}
            </span>
            {copied && (
                <span style={{ color: "#6c6", fontSize: 10, fontFamily: sansFont }}>
                    copied
                </span>
            )}
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", color: "#666", textDecoration: "none" }}
                title={t("components.data_viewer_dialog.open_in_new_tab")}
            >
                <OpenInNewIcon style={{ fontSize: 14 }} />
            </a>
        </div>
    );
});
UrlBar.displayName = "UrlBar";

// ─── Styles ────────────────────────────────────────────────────

const styles = () => ({
    dialog: {
        "& .MuiDialog-paper": {
            backgroundColor: "#0d0d0d",
            color: "#ccc",
            borderRadius: 16,
            maxWidth: 960,
            width: "100%",
            height: "80vh",
            maxHeight: "80vh",
            margin: 16,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            position: "relative", // anchor for the absolutely-positioned bottom drawer
        },
        // Below the mobile breakpoint, the dialog goes edge-to-edge and
        // full-height — there's no room for margin or rounding.
        "@media (max-width: 767px)": {
            "& .MuiDialog-paper": {
                margin: 0,
                borderRadius: 0,
                height: "100%",
                maxHeight: "100%",
                width: "100%",
                maxWidth: "100%",
            },
        },
    },
    titleBar: {
        display: "flex",
        alignItems: "center",
        padding: "14px 16px 14px 20px",
        borderBottom: "1px solid #1a1a1a",
        background: "#0a0a0a",
        minHeight: 56,
        flexShrink: 0,
        "@media (max-width: 767px)": {
            padding: "12px 8px 12px 14px",
            minHeight: 52,
        },
    },
    titleText: {
        fontFamily: "'Industry Book', 'Normative Pro', sans-serif",
        fontSize: 16,
        fontWeight: 600,
        color: "#bbb",
        flexGrow: 1,
        "@media (max-width: 767px)": {
            fontSize: 14,
        },
    },
    bodyContainer: {
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
    },
    splitContainer: {
        display: "flex",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        // On mobile the detail pane is hosted in the bottom drawer
        // instead of sitting beside the tree, so the split becomes a
        // single full-width column.
        "@media (max-width: 767px)": {
            flexDirection: "column",
        },
    },
    treePane: {
        width: "45%",
        minWidth: 200,
        overflow: "auto",
        borderRight: "1px solid #1a1a1a",
        paddingTop: 4,
        paddingBottom: 16,
        flexShrink: 0,
        "&::-webkit-scrollbar": { width: 4 },
        "&::-webkit-scrollbar-track": { background: "transparent" },
        "&::-webkit-scrollbar-thumb": { background: "#222", borderRadius: 6 },
        "@media (max-width: 767px)": {
            width: "100%",
            minWidth: 0,
            borderRight: "none",
            // CRITICAL: in the mobile column layout, treePane is a flex
            // *child* of a column. Without `flex: 1` + `minHeight: 0` it
            // would size to content, and `overflow: auto` would have no
            // height constraint to scroll against — i.e. it wouldn't
            // scroll at all. Also override flexShrink (set above for
            // desktop row layout) — in column layout we want the pane
            // to fill remaining height, not stay rigid.
            flex: 1,
            minHeight: 0,
            flexShrink: 1,
            WebkitOverflowScrolling: "touch",
        },
    },
    detailPane: {
        flex: 1,
        overflow: "auto",
        "&::-webkit-scrollbar": { width: 4 },
        "&::-webkit-scrollbar-track": { background: "transparent" },
        "&::-webkit-scrollbar-thumb": { background: "#222", borderRadius: 6 },
        // On mobile, this desktop side pane is hidden — the drawer
        // takes over.
        "@media (max-width: 767px)": {
            display: "none",
        },
    },
    centerState: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        gap: 12,
        color: "#666",
        fontFamily: "'Industry Book', 'Normative Pro', sans-serif",
        fontSize: 12,
        textAlign: "center",
        padding: "0 24px",
    },
    statusBar: {
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "8px 20px",
        background: "#0a0a0a",
        borderTop: "1px solid #1a1a1a",
        fontSize: 11,
        color: "#888",
        fontFamily: "'Industry Book', 'Normative Pro', sans-serif",
        minHeight: 36,
        flexShrink: 0,
        "@media (max-width: 767px)": {
            gap: 10,
            padding: "6px 12px",
            fontSize: 10,
            minHeight: 32,
            // Long path strings need to wrap or truncate; we let the
            // children handle their own truncation.
            overflow: "hidden",
        },
    },
    // The type-glyph legend on the right side of the status bar is dense
    // and not very useful on small screens — hidden below the breakpoint.
    statusLegend: {
        marginLeft: "auto",
        fontFamily: "'Geist Mono', monospace",
        "@media (max-width: 767px)": {
            display: "none",
        },
    },
    iconBtn: {
        color: "#666",
        padding: 6,
        "&:hover": { color: "#aaa", backgroundColor: "rgba(255,255,255,0.04)" },
        "@media (max-width: 767px)": {
            padding: 4,
        },
    },
});

// ─── Identifier resolver ───────────────────────────────────────
//
// Pulls a fetchable (author, permlink) pair out of any of:
//   • explicit `author` + `permlink` props (`author` may be a plain
//     string or an object with `.username`);
//   • a `data` prop that is itself a post-shaped object (sanitized or
//     raw) — we look at `data.author` / `data.author.username` and
//     `data.permlink`.
// Returns { author: string|null, permlink: string|null }.
function resolveIdentifiers({ author, permlink, data }) {
    const fromAuthor = (a) => {
        if (typeof a === "string") return a.replace(/^@/, "").trim() || null;
        if (a && typeof a === "object") {
            const u = a.username || a.account || a.name;
            return typeof u === "string" ? u.replace(/^@/, "").trim() || null : null;
        }
        return null;
    };
    let resolvedAuthor = fromAuthor(author);
    let resolvedPermlink = (typeof permlink === "string" && permlink.trim()) || null;

    if ((!resolvedAuthor || !resolvedPermlink) && data && typeof data === "object" && !Array.isArray(data)) {
        if (!resolvedAuthor) resolvedAuthor = fromAuthor(data.author);
        if (!resolvedPermlink && typeof data.permlink === "string" && data.permlink.trim()) {
            resolvedPermlink = data.permlink.trim();
        }
    }

    return { author: resolvedAuthor, permlink: resolvedPermlink };
}

// ─── Main Component ────────────────────────────────────────────
//
// Three calling forms — all converge on api-mode if `api` is supplied:
//
//   1. Explicit identifiers:
//      <DataViewerDialog open onClose={…}
//          api={pixaApi} author="primerz2" permlink="matias-1778088296998" />
//
//   2. Author as object (sanitized entity shape, common from feed UIs):
//      <DataViewerDialog open onClose={…}
//          api={pixaApi}
//          author={{ username: "primerz2", name: "Test", image: "…" }}
//          permlink="matias-1778088296998" />
//
//   3. Just a post object (any shape — sanitized or raw):
//      <DataViewerDialog open onClose={…} api={pixaApi} data={post} />
//      The dialog extracts `author.username` / `author` and `permlink`
//      from the object and fetches fresh. The originally-passed `data`
//      is discarded once the fetch resolves.
//
//   4. Pure direct mode (no api), fall back to displaying `data` as-is:
//      <DataViewerDialog open onClose={…} data={anyObject} />
//
// In all api-mode forms the dialog calls
//   api.content.getContent(author, permlink, { raw: true })
// on open and on every refresh, displaying the un-sanitized chain
// payload. The canonical post URL is built from `category` + `author`
// + `permlink` once data lands.
const DataViewerDialog = React.memo(({ classes, open, onClose, data, api, author, permlink }) => {
    useLanguage();
    const [selectedId, setSelectedId] = useState(null);
    const [expanded, setExpanded] = useState(new Set());

    // Responsive state — drives whether the detail view is rendered as
    // a side pane (desktop) or a bottom drawer (mobile).
    const isMobile = useIsMobile();
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Fetch state (used in api-mode only)
    const [fetchedData, setFetchedData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const fetchSeqRef = useRef(0);

    // Resolve (author, permlink) from whichever calling form was used.
    const { author: resolvedAuthor, permlink: resolvedPermlink } = useMemo(
        () => resolveIdentifiers({ author, permlink, data }),
        [author, permlink, data]
    );

    const apiMode = !!(api && resolvedAuthor && resolvedPermlink);

    const fetchFresh = useCallback(async () => {
        if (!apiMode) return;
        const seq = ++fetchSeqRef.current;
        setLoading(true);
        setError(null);
        try {
            const result = await api.content.getContent(resolvedAuthor, resolvedPermlink, { raw: true });
            if (seq !== fetchSeqRef.current) return; // stale response
            if (!result) {
                setError(t("components.data_viewer_dialog.no_content_returned_the_post_may_not"));
                setFetchedData(null);
            } else {
                setFetchedData(result);
            }
        } catch (e) {
            if (seq !== fetchSeqRef.current) return;
            setError(e?.message || "Fetch failed");
            setFetchedData(null);
        } finally {
            if (seq === fetchSeqRef.current) setLoading(false);
        }
    }, [api, resolvedAuthor, resolvedPermlink, apiMode]);

    // Auto-fetch when the dialog opens (or identifiers change while open).
    // When the dialog closes we cancel any in-flight result and clear state.
    useEffect(() => {
        if (open && apiMode) {
            fetchFresh();
        }
        if (!open) {
            fetchSeqRef.current++;
            setFetchedData(null);
            setError(null);
            setLoading(false);
        }
    }, [open, apiMode, fetchFresh]);

    // Active payload: api-mode prefers freshly fetched data; otherwise legacy `data` prop.
    const activeData = apiMode ? fetchedData : data;

    const tree = useMemo(() => {
        if (!activeData) return null;
        _nodeId = 0;
        // Strip top-level properties that begin with an underscore — these
        // are sanitization-pipeline metadata (_entity_type, _stale, _cachedAt,
        // …) and aren't part of the chain payload itself. With raw=true the
        // chain rarely emits these, but the strip is harmless and protects
        // legacy callers passing already-sanitized entities.
        let cleaned = activeData;
        if (typeof activeData === "object" && activeData !== null && !Array.isArray(activeData)) {
            cleaned = {};
            for (const key of Object.keys(activeData)) {
                if (!key.startsWith("_")) cleaned[key] = activeData[key];
            }
        }
        return buildTree("root", cleaned);
    }, [activeData]);

    useEffect(() => {
        if (tree) {
            setExpanded(new Set([tree.id]));
            setSelectedId(null);
        }
    }, [tree]);

    // Close the mobile drawer whenever the dialog itself closes or the
    // underlying data resets — prevents a stale detail panel from
    // flashing in on the next open.
    useEffect(() => {
        if (!open) setDrawerOpen(false);
    }, [open]);

    // On mobile, selecting a node opens the drawer with that node's
    // detail. On desktop, selection just updates the side pane.
    const handleSelect = useCallback((id) => {
        setSelectedId(id);
        if (isMobile) setDrawerOpen(true);
    }, [isMobile]);

    const handleDrawerClose = useCallback(() => {
        setDrawerOpen(false);
    }, []);

    const selectedNode = useMemo(() => {
        if (!selectedId || !tree) return null;
        return findNode(tree, selectedId);
    }, [tree, selectedId]);

    const onToggle = useCallback((id) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const handleExpandAll = useCallback(() => {
        if (!tree) return;
        const all = new Set();
        const walk = (n) => { all.add(n.id); (n.children || []).forEach(walk); };
        walk(tree);
        setExpanded(all);
    }, [tree]);

    const handleCollapseAll = useCallback(() => {
        if (tree) setExpanded(new Set([tree.id]));
    }, [tree]);

    const nodeCount = useMemo(() => {
        if (!tree) return 0;
        let c = 0;
        const walk = (n) => { c++; (n.children || []).forEach(walk); };
        walk(tree);
        return c;
    }, [tree]);

    // Canonical post URL — built from category + author + permlink in the payload.
    const postUrl = useMemo(() => buildPostUrl(activeData), [activeData]);

    // Don't render if there's nothing to show and no api to fetch with.
    if (!apiMode && !data) return null;

    return (
        <Dialog
            className={classes.dialog}
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="md"
        >
            {/* Title Bar */}
            <div className={classes.titleBar}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style={{ marginRight: 10, flexShrink: 0 }}>
                    <rect x="2" y="2" width="18" height="18" rx="4" stroke="#555" strokeWidth="1.2" fill="none" />
                    <path d="M7 7h3v3H7zM12 7h3v3h-3zM7 12h3v3H7zM12 12h3v3h-3z" fill="#555" opacity="0.6" />
                </svg>
                <Typography className={classes.titleText} component="span">
                    {t("components.data_viewer_dialog.data_inspector")}
                </Typography>
                {apiMode && (
                    <IconButton
                        className={classes.iconBtn}
                        onClick={fetchFresh}
                        size="small"
                        disabled={loading}
                        title={t("components.data_viewer_dialog.refresh_from_chain")}
                    >
                        <RefreshIcon
                            fontSize="small"
                            style={{ animation: loading ? "dvSpin 0.9s linear infinite" : "none" }}
                        />
                    </IconButton>
                )}
                <IconButton className={classes.iconBtn} onClick={handleExpandAll} size="small" title={t("components.data_viewer_dialog.expand_all")}>
                    <UnfoldMoreIcon fontSize="small" />
                </IconButton>
                <IconButton className={classes.iconBtn} onClick={handleCollapseAll} size="small" title={t("components.data_viewer_dialog.collapse_all")}>
                    <UnfoldLessIcon fontSize="small" />
                </IconButton>
                <IconButton className={classes.iconBtn} onClick={onClose} size="small">
                    <CloseIcon fontSize="small" />
                </IconButton>
            </div>
            {/* Local keyframe — no global CSS pollution. */}
            <style>{`@keyframes dvSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            {/* URL bar (only when we can build one from the payload) */}
            <UrlBar url={postUrl} />
            {/* Body — loading / error / tree */}
            <div className={classes.bodyContainer}>
                {loading && !activeData && (
                    <div className={classes.centerState}>
                        <CircularProgress size={28} style={{ color: "#666" }} />
                        <span><T
                            k="components.data_viewer_dialog.fetching_0_0_from_chain"
                            vars={{
                                text: " ",
                                resolvedAuthor: resolvedAuthor,
                                resolvedPermlink: resolvedPermlink,
                                text_2: " "
                            }}
                            slots={[<span style={{ color: "#999", fontFamily: mono }} key="0" />]} /></span>
                    </div>
                )}

                {!loading && error && !activeData && (
                    <div className={classes.centerState}>
                        <span style={{ color: "#ffffff" }}>{error}</span>
                        {apiMode && (
                            <span
                                onClick={fetchFresh}
                                style={{
                                    cursor: "pointer", color: "#888",
                                    textDecoration: "underline", fontSize: 11,
                                }}
                            >
                                retry
                            </span>
                        )}
                    </div>
                )}

                {activeData && (
                    <div className={classes.splitContainer}>
                        <div className={classes.treePane}>
                            {tree && (
                                <TreeNode
                                    node={tree}
                                    depth={0}
                                    selectedId={selectedId}
                                    onSelect={handleSelect}
                                    expanded={expanded}
                                    onToggle={onToggle}
                                />
                            )}
                        </div>
                        {/* Desktop: detail sits beside the tree.
                            Mobile: this pane is display:none via styles
                            and the drawer below takes over. */}
                        <div className={classes.detailPane}>
                            <DetailPane node={selectedNode} />
                        </div>
                    </div>
                )}
            </div>
            {/* Mobile bottom drawer — only renders the DetailPane when
                a node is selected and the drawer is requested open. */}
            {isMobile && (
                <BottomDrawer open={drawerOpen && !!selectedNode} onClose={handleDrawerClose}>
                    <DetailPane node={selectedNode} />
                </BottomDrawer>
            )}
            {/* Status Bar */}
            <div className={classes.statusBar}>
                <span style={{ flexShrink: 0 }}>{t("components.data_viewer_dialog.nodes", {
                    nodeCount: nodeCount
                })}</span>
                {selectedNode && (
                    <span style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                    }}>{t("components.data_viewer_dialog.path", {
                        path: selectedNode.path
                    })}</span>
                )}
                {apiMode && (
                    <span style={{ color: loading ? "#888" : "#ffffff", flexShrink: 0 }}>
                        {loading ? "● fetching" : "● raw"}
                    </span>
                )}
                <span className={classes.statusLegend}>
                    S<span style={{ fontFamily: "'Industry Book', sans-serif" }}>{t("components.data_viewer_dialog.string")} </span>
                    #<span style={{ fontFamily: "'Industry Book', sans-serif" }}>{t("components.data_viewer_dialog.number")} </span>
                    B<span style={{ fontFamily: "'Industry Book', sans-serif" }}>{t("components.data_viewer_dialog.bool")} </span>
                    {"{"}<span style={{ fontFamily: "'Industry Book', sans-serif" }}>{t("components.data_viewer_dialog.obj")} </span>
                    [<span style={{ fontFamily: "'Industry Book', sans-serif" }}>{t("components.data_viewer_dialog.arr")} </span>
                    ∅<span style={{ fontFamily: "'Industry Book', sans-serif" }}>{t("components.data_viewer_dialog.null")}</span>
                </span>
            </div>
        </Dialog>
    );
});

DataViewerDialog.displayName = "DataViewerDialog";

export default withStyles(styles)(DataViewerDialog);