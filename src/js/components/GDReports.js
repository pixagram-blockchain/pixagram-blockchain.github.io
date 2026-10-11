// Reports card for the governance dialog: the witness, finance and statistics reports the Tower writes
// for every day, ISO week and month, ready to post. A row opens the report, rendered, in a dialog, or
// copies its Markdown.
import * as React from "preact/compat";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";

import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import OpenInNewRoundedIcon from "@material-ui/icons/OpenInNewRounded";
import FileCopyOutlinedIcon from "@material-ui/icons/FileCopyOutlined";
import CheckRoundedIcon from "@material-ui/icons/CheckRounded";
import DescriptionOutlinedIcon from "@material-ui/icons/DescriptionOutlined";

import { useLanguage } from "../utils/text";
import { safeHTML } from "../utils/api/sanitizer";
import { listReports, reportMarkdown, reportUrl, REPORT_PERIODS } from "../utils/towerAccount";
import { tr, trf, Card, Switch, Empty, Skeleton, Pill, fmtDate, useSeen } from "./GDTowerKit";

const K = "components.gdreports.";

const action = {
    appearance: "none",
    border: "none",
    background: "transparent",
    color: "#888",
    borderRadius: "16px",
    padding: "6px 10px",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    fontFamily: "'Geist Mono', monospace",
    cursor: "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
    transition: "all 150ms ease",
    "&:hover": { backgroundColor: "rgba(255,255,255,0.06)", color: "#fff" },
    "&:focus-visible": { outline: "none", boxShadow: "0 0 0 2px #555" }
};

const styles = (theme) => ({
    controls: { display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" },
    rows: { display: "flex", flexDirection: "column", gap: "2px", margin: "0 -8px" },
    row: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "center",
        gap: "12px",
        padding: "6px 8px",
        borderRadius: "10px",
        transition: "background-color 150ms ease",
        "&:hover": { backgroundColor: "#171717" }
    },
    rowMain: { minWidth: 0, cursor: "pointer" },
    title: { fontSize: "14px", color: "#ddd", fontFamily: "'Normative Pro'", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    sub: { fontSize: "12px", color: "#666", fontFamily: "'Normative Pro'", marginTop: "2px" },
    actions: { display: "flex", alignItems: "center", gap: "4px" },
    action,
    actionIcon: { fontSize: "15px" },
    note: { fontSize: "12px", color: "#666", fontFamily: "'Normative Pro'", marginTop: "10px", lineHeight: 1.5 },

    // ---- the report dialog
    dialog: {
        "& .MuiDialog-paperScrollPaper": { [theme.breakpoints.down("sm")]: { maxHeight: "100%" } }
    },
    dialogContent: {
        padding: "28px 32px 12px 32px",
        [theme.breakpoints.down("xs")]: { padding: "20px 16px 8px 16px" }
    },
    dialogActions: { padding: "8px 16px 16px 16px", flexWrap: "wrap", gap: "4px" },
    loading: { display: "flex", flexDirection: "column", gap: "12px" },
    // The report, rendered: document type, tables told apart by fill, never by rules.
    markdown: {
        color: "#bbb",
        fontFamily: "'Normative Pro'",
        fontSize: "14px",
        lineHeight: 1.6,
        overflowWrap: "anywhere",
        "& > :first-child": { marginTop: 0 },
        "& h1": { fontFamily: "'Industry Book'", fontSize: "22px", fontWeight: 600, color: "#fff", lineHeight: 1.3, margin: "0 0 8px 0" },
        "& h2": {
            fontFamily: "'Industry Book'",
            fontSize: "12px",
            fontWeight: 500,
            color: "#888",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            margin: "32px 0 10px 0"
        },
        "& h3, & h4": { fontSize: "15px", fontWeight: 600, color: "#ddd", margin: "20px 0 8px 0" },
        "& p": { margin: "0 0 12px 0" },
        "& ul, & ol": { margin: "0 0 12px 0", paddingLeft: "20px" },
        "& li": { margin: "4px 0" },
        "& strong": { color: "#fff", fontWeight: 600 },
        "& em": { color: "#888" },
        "& a": { color: "#fff", textDecoration: "underline", textDecorationColor: "#555", "&:hover": { textDecorationColor: "#fff" } },
        "& code": { fontFamily: "'Geist Mono', monospace", fontSize: "12px", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "6px", padding: "1px 6px" },
        "& pre": { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "12px 16px", overflowX: "auto", "& code": { backgroundColor: "transparent", padding: 0 } },
        "& blockquote": { margin: "0 0 12px 0", padding: "8px 16px", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "10px", color: "#aaa" },
        "& hr": { border: "none", height: "1px", backgroundColor: "rgba(255,255,255,0.08)", margin: "24px 0" },
        // wide tables scroll sideways on their own instead of widening the dialog
        "& table": {
            display: "block",
            maxWidth: "100%",
            overflowX: "auto",
            borderCollapse: "separate",
            borderSpacing: 0,
            margin: "4px 0 16px 0",
            fontSize: "13px"
        },
        "& th": {
            textAlign: "left",
            fontFamily: "'Industry Book'",
            fontSize: "11px",
            fontWeight: 500,
            color: "#888",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            padding: "8px 12px",
            backgroundColor: "rgba(255,255,255,0.06)", // fills, not colours: they sit on whatever the dialog's paper is
            whiteSpace: "nowrap"
        },
        "& th:first-child": { borderRadius: "8px 0 0 8px" },
        "& th:last-child": { borderRadius: "0 8px 8px 0" },
        "& td": { padding: "7px 12px", color: "#ddd", whiteSpace: "nowrap", verticalAlign: "top" },
        "& tbody tr:hover td": { backgroundColor: "rgba(255,255,255,0.03)" }
    },
    // columns of figures, right-aligned so the digits line up (set after rendering, see alignNumbers)
    num: { textAlign: "right !important", fontFamily: "'Geist Mono', monospace", fontVariantNumeric: "tabular-nums" }
});

const KIND_LABELS = {
    witnesses: () => tr(K + "kind_witnesses", "Witnesses"),
    finance: () => tr(K + "kind_finance", "Finance"),
    statistics: () => tr(K + "kind_statistics", "Statistics")
};
const PERIOD_LABELS = {
    day: () => tr(K + "period_day", "Daily"),
    week: () => tr(K + "period_week", "Weekly"),
    month: () => tr(K + "period_month", "Monthly")
};

/** "Week of 5 Oct 2026", "October 2026", "5 Oct 2026". */
function periodName(period, date) {
    const sec = Date.parse(date + "T00:00:00Z") / 1000;
    if (period === "month") return fmtDate(sec, { month: "long", year: "numeric" });
    const day = fmtDate(sec, { day: "numeric", month: "short", year: "numeric" });
    return period === "week" ? trf(K + "week_of_n", "Week of {n}", { n: day }) : day;
}

// ---------------------------------------------------------------- Markdown

const renderMarkdown = (markdown) => {
    try {
        return micromark(markdown, {
            extensions: [gfm()],
            htmlExtensions: [gfmHtml()]
        });
    } catch (error) {
        console.error("Error rendering markdown:", error);
        return "<p>Error rendering content</p>";
    }
};

// A report is stored once its period has closed and never changes after: its Markdown is kept for the
// session. The open period's report is built on request, so it is fetched each time.
const finalMarkdown = new Map(); // url -> Promise<string>

function loadMarkdown(url, final) {
    if (final && finalMarkdown.has(url)) return finalMarkdown.get(url);
    const p = reportMarkdown(url);
    if (final) {
        finalMarkdown.set(url, p);
        p.catch(() => finalMarkdown.delete(url));
    }
    return p;
}

const NUMBER = /^(?:[–—-]|[+−-]?\d[\d,.\s]*%?)$/;

/** Right-aligns the table columns whose cells are all figures (or "–"), so the digits line up. */
function alignNumbers(root, numClass) {
    if (!root) return;
    for (const table of root.querySelectorAll("table")) {
        const rows = Array.from(table.rows);
        const body = rows.filter((r) => !(r.parentNode && r.parentNode.tagName === "THEAD"));
        const cols = Math.max(0, ...rows.map((r) => r.cells.length));
        for (let c = 0; c < cols; c++) {
            const cells = body.map((r) => r.cells[c]).filter(Boolean);
            if (cells.length && cells.every((cell) => NUMBER.test(cell.textContent.trim()))) {
                for (const r of rows) if (r.cells[c]) r.cells[c].classList.add(numClass);
            }
        }
    }
}

/** Links in a report open in a new tab: following one inside the app would leave the governance dialog. */
function openLinksOutside(e) {
    const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    const href = a ? a.getAttribute("href") || "" : "";
    if (/^https?:\/\//i.test(href)) {
        e.preventDefault();
        window.open(href, "_blank", "noopener,noreferrer");
    }
}

// ---------------------------------------------------------------- copy

/**
 * Copies the Markdown at `url`. The clipboard write starts inside the click (a ClipboardItem that waits for
 * the download), because Safari, and Firefox after a few seconds, refuse a write made once the click is over.
 */
function copyReport(url, final) {
    const text = loadMarkdown(url, final);
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard && navigator.clipboard.write) {
        try {
            const item = new ClipboardItem({ "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })) });
            return navigator.clipboard.write([item]).catch(() => text.then(copyText));
        } catch (e) {
            // ClipboardItem without promise support: fall through
        }
    }
    return text.then(copyText);
}

function copyText(text) {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).catch(() => copyWithSelection(text));
    }
    return copyWithSelection(text);
}

/** Old browsers: copy through a selected, invisible textarea. */
function copyWithSelection(text) {
    return new Promise((resolve, reject) => {
        try {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand("copy");
            document.body.removeChild(ta);
            if (ok) resolve();
            else reject(new Error("copy refused"));
        } catch (e) {
            reject(e);
        }
    });
}

function CopyButton({ classes, state, onClick }) {
    return (
        <button type="button" className={classes.action} onClick={onClick} title={tr(K + "copy_markdown", "Copy the Markdown, ready to post")}>
            {state === "done" ? <CheckRoundedIcon className={classes.actionIcon} /> : <FileCopyOutlinedIcon className={classes.actionIcon} />}
            {state === "done" ? tr(K + "copied", "Copied") : state === "error" ? tr(K + "copy_failed", "Failed") : tr(K + "copy", "Copy")}
        </button>
    );
}

// ---------------------------------------------------------------- dialog

/** The report `report` ({ id, name, open, md }), rendered from its Markdown. Closed when `report` is null. */
function ReportDialog({ classes, report, onClose, copyState, onCopy }) {
    // keep the last report on screen while the dialog fades out
    const last = React.useRef(null);
    if (report) last.current = report;
    const shown = report || last.current;

    const [doc, setDoc] = React.useState({ url: null, md: null, error: null });
    const body = React.useRef(null);
    const url = report ? report.md : null;

    React.useEffect(() => {
        if (!report) return undefined;
        let alive = true;
        setDoc({ url: report.md, md: null, error: null });
        loadMarkdown(report.md, !report.open).then(
            (md) => alive && setDoc({ url: report.md, md, error: null }),
            (error) => alive && setDoc({ url: report.md, md: null, error })
        );
        return () => {
            alive = false;
        };
    }, [url]);

    const ready = !!shown && doc.url === shown.md && doc.md != null;
    const failed = !!shown && doc.url === shown.md && !!doc.error;
    // micromark (GitHub flavour: tables, strikethrough, autolinks), then the app's sanitizer
    const html = React.useMemo(() => (ready ? safeHTML(renderMarkdown(doc.md)) : ""), [ready, doc.md]);
    React.useEffect(() => {
        if (ready) alignNumbers(body.current, classes.num);
    }, [html]);

    return (
        <Dialog
            className={classes.dialog}
            open={!!report}
            onClose={onClose}
            fullWidth={true}
            maxWidth="md"
            scroll="paper"
            aria-label={shown ? shown.name : undefined}
        >
            <DialogContent className={classes.dialogContent}>
                {failed ? (
                    <Empty>{tr(K + "report_failed", "The report could not be loaded.")}</Empty>
                ) : !ready ? (
                    <div className={classes.loading}>
                        <Skeleton height={30} />
                        <Skeleton height={48} />
                        <Skeleton height={180} />
                    </div>
                ) : (
                    <div ref={body} className={classes.markdown} onClick={openLinksOutside} dangerouslySetInnerHTML={{ __html: html }} />
                )}
            </DialogContent>
            <DialogActions className={classes.dialogActions}>
                {shown ? (
                    <a className={classes.action} href={shown.md} target="_blank" rel="noopener noreferrer" title={tr(K + "open_markdown", "Open the Markdown")}>
                        <OpenInNewRoundedIcon className={classes.actionIcon} />
                        {tr(K + "markdown", "Markdown")}
                    </a>
                ) : null}
                {shown ? <CopyButton classes={classes} state={copyState} onClick={() => onCopy(shown)} /> : null}
                <Button onClick={onClose} autoFocus variant="contained" color="primary">
                    {tr("words.close", "Close")}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

// ---------------------------------------------------------------- card

/**
 * Props: kinds (the report kinds this card offers, first one selected), title, subtitle, info.
 * The first row is the period still open (built on request); the others are the stored reports.
 */
function GDReports({ classes, kinds, title, subtitle, info }) {
    useLanguage();
    const [seenRef, seen] = useSeen();
    const [kind, setKind] = React.useState(kinds[0]);
    const [period, setPeriod] = React.useState("week");
    const [state, setState] = React.useState({ key: null, list: null, error: null });
    const [copied, setCopied] = React.useState(null);
    const [reading, setReading] = React.useState(null);
    const key = `${kind}:${period}`;

    React.useEffect(() => {
        if (!seen) return undefined; // the dialog keeps every tab mounted: load once this card is shown
        let alive = true;
        listReports(kind, period, 8)
            .then((list) => alive && setState({ key, list, error: null }))
            .catch((error) => alive && setState({ key, list: null, error }));
        return () => {
            alive = false;
        };
    }, [key, seen]);

    const copy = (r) => {
        copyReport(r.md, !r.open)
            .then(() => {
                setCopied(r.md);
                setTimeout(() => setCopied((c) => (c === r.md ? null : c)), 2000);
            })
            .catch(() => setCopied("error:" + r.md));
    };
    const copyState = (r) => (copied === r.md ? "done" : copied === "error:" + r.md ? "error" : null);

    const list = state.key === key ? state.list : null;
    const current = { id: "current", name: tr(K + "current_period", "Current period"), open: true, md: reportUrl(kind, period, "md") };
    const rows = list ? [current, ...list.map((r) => ({ id: r.date, name: periodName(period, r.date), open: false, md: reportUrl(r.markdown) }))] : [];

    return (
        <Card title={title} subtitle={subtitle} info={info}>
            <div className={classes.controls} ref={seenRef}>
                {kinds.length > 1 ? (
                    <Switch label={tr(K + "kind", "Report")} value={kind} onChange={setKind} options={kinds.map((k) => ({ value: k, label: KIND_LABELS[k]() }))} />
                ) : null}
                <Switch label={tr(K + "period", "Period")} value={period} onChange={setPeriod} options={REPORT_PERIODS.map((p) => ({ value: p, label: PERIOD_LABELS[p]() }))} />
            </div>
            {state.error && state.key === key ? (
                <Empty>{tr(K + "unavailable", "Reports are not available from the statistics service yet.")}</Empty>
            ) : !list ? (
                <Skeleton height={160} />
            ) : (
                <div className={classes.rows}>
                    {rows.map((r) => (
                        <div key={r.id} className={classes.row}>
                            <div className={classes.rowMain} onClick={() => setReading(r)}>
                                <div className={classes.title}>{r.name}</div>
                                <div className={classes.sub}>
                                    {r.open ? <Pill level="muted" icon={false}>{tr(K + "open", "still open")}</Pill> : tr(K + "final", "final")}
                                </div>
                            </div>
                            <div className={classes.actions}>
                                <button type="button" className={classes.action} onClick={() => setReading(r)}>
                                    <DescriptionOutlinedIcon className={classes.actionIcon} />
                                    {tr(K + "read", "Read")}
                                </button>
                                <CopyButton classes={classes} state={copyState(r)} onClick={() => copy(r)} />
                            </div>
                        </div>
                    ))}
                    {list.length === 0 ? <div className={classes.note}>{tr(K + "none_stored", "No closed period yet: reports are stored when their period ends.")}</div> : null}
                </div>
            )}
            <ReportDialog
                classes={classes}
                report={reading}
                onClose={() => setReading(null)}
                copyState={reading ? copyState(reading) : null}
                onCopy={copy}
            />
        </Card>
    );
}

export default withStyles(styles)(GDReports);
