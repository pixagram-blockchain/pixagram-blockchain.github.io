import * as React from "preact/compat";

import { t } from "../utils/text";

// ── ErrorBoundary ──────────────────────────────────────────────────────
// The codebase currently has NO error boundaries: one throw during
// render — a malformed `json_metadata`, an unexpected null in a chain
// payload — unmounts the whole feed or dialog tree instead of the one
// broken card. This component (and its HOC) contains the blast radius.
//
//   Suggested location: src/components/ErrorBoundary.js
//
// Direct use:
//
//   <ErrorBoundary label="comments" resetKey={post.id}>
//       <CommentsPane … />
//   </ErrorBoundary>
//
// HOC use (how PaperCard.js adopts it):
//
//   export default withErrorBoundary(PaperCard, {
//       label: "post card",
//       getResetKey: (props) => props && props.data && props.data.id,
//   });
//
// Props:
//   label     — short noun for the default fallback text + console tag.
//   fallback  — ReactNode, or (error, retry) => ReactNode. Omit for the
//               built-in dark-themed fallback with a Retry button.
//   resetKey  — when this value changes while an error is showing, the
//               boundary clears itself and re-renders children (e.g. a
//               recycled virtualized cell receiving a new post).
//   onError   — (error, info) hook for reporting/telemetry.
//
// Works under preact/compat: both getDerivedStateFromError and
// componentDidCatch are supported by Preact X.
// ───────────────────────────────────────────────────────────────────────

// Matches the app's surfaces (#171717 panels, #989898 secondary text,
// rounded 16–21 px corners) without importing the theme.
const FALLBACK_STYLE = {
    boxSizing: "border-box",
    padding: "16px",
    borderRadius: "16px",
    backgroundColor: "#171717",
    color: "#989898",
    fontSize: "0.85rem",
    fontFamily: '"Normative Pro", "Industry Book", sans-serif',
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minHeight: "56px",
    textAlign: "center",
};

const RETRY_STYLE = {
    color: "#fff",
    backgroundColor: "transparent",
    border: "1px solid #333",
    borderRadius: "12px",
    padding: "3px 12px",
    cursor: "pointer",
    font: "inherit",
    lineHeight: 1.4,
};

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        const tag = this.props.label ? `[ErrorBoundary:${this.props.label}]` : "[ErrorBoundary]";
        console.error(tag, error, info && info.componentStack);
        if (typeof this.props.onError === "function") {
            try { this.props.onError(error, info); } catch (e) { /* never rethrow from reporting */ }
        }
    }

    componentDidUpdate(prevProps) {
        // New content arrived (e.g. a virtualized cell was recycled for a
        // different post) — give it a clean slate.
        if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ error: null });
        }
    }

    _retry = () => this.setState({ error: null });

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        const { fallback, label } = this.props;
        if (typeof fallback === "function") return fallback(error, this._retry);
        if (fallback !== undefined && fallback !== null) return fallback;

        return (
            <div style={FALLBACK_STYLE} role="alert">
                <span>{t("components.error_boundary.couldnt_render_this", {
                    label: label || "content"
                })}</span>
                <button style={RETRY_STYLE} onClick={this._retry}>{t("components.error_boundary.retry")}</button>
            </div>
        );
    }
}

/**
 * Wrap a component so every instance gets its own boundary. Options are
 * ErrorBoundary props, plus `getResetKey(props)` to derive `resetKey`
 * from the wrapped component's own props.
 */
export function withErrorBoundary(Component, options) {
    const { getResetKey, ...boundaryProps } = options || {};

    const Wrapped = React.forwardRef(function ErrorBoundaryWrapper(props, ref) {
        return (
            <ErrorBoundary
                {...boundaryProps}
                resetKey={getResetKey ? getResetKey(props) : undefined}
            >
                <Component {...props} ref={ref} />
            </ErrorBoundary>
        );
    });

    Wrapped.displayName =
        `withErrorBoundary(${Component.displayName || Component.name || "Component"})`;
    return Wrapped;
}

export default ErrorBoundary;
