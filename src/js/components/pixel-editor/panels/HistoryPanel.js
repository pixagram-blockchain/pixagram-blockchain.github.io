// ============================================================================
// pixel-editor/panels/HistoryPanel.js — every step since the editor opened
//
// Newest first. A tap goes straight to that state (undoing or redoing as
// many steps as it takes); undone steps stay listed, dimmed, until something
// new is done.
// ============================================================================

import * as React from "preact/compat";
import makeStyles from "@material-ui/core/styles/makeStyles";
import ButtonBase from "@material-ui/core/ButtonBase";

import { tp, historyLabel } from "../labels";
import { useEditorEvents } from "../editorUtils";
import { Section, Hint, EASE } from "../ui";

const useStyles = makeStyles({
    list: {
        margin: 0,
        padding: 0,
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        gap: 2,
    },
    item: {
        width: "100%",
        minHeight: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "0 16px",
        borderRadius: 22,
        color: "#cccccc",
        fontFamily: `"Industry Book", "Normative Pro"`,
        fontSize: 14,
        textAlign: "left",
        transition: `background-color 160ms ${EASE}, color 160ms ${EASE}`,
        "&:hover": { backgroundColor: "#171717", color: "#ffffff" },
    },
    current: {
        backgroundColor: "#e9e9e9 !important",
        color: "#1d1d1d !important",
    },
    undone: {
        color: "#5f5f5f",
    },
    time: {
        flex: "0 0 auto",
        fontFamily: `"Geist Mono", "Red Hat Display"`,
        fontSize: 11,
        opacity: 0.7,
    },
});

const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function HistoryPanel({ ed }) {
    const classes = useStyles();
    useEditorEvents(ed, ["history"]);
    const list = ed.history.list();
    const at = ed.history.index;
    const rows = [];
    for (let i = list.length; i >= 0; i--) {
        const e = i > 0 ? list[i - 1] : null;
        rows.push(
            <li key={e ? e.id : "opened"}>
                <ButtonBase
                    className={classes.item + (i === at ? " " + classes.current : i > at ? " " + classes.undone : "")}
                    aria-current={i === at}
                    onClick={() => ed.goTo(i)}
                >
                    <span>{e ? historyLabel(e.label) : tp("history_opened")}</span>
                    {e && <span className={classes.time}>{clock(e.time)}</span>}
                </ButtonBase>
            </li>
        );
    }
    return (
        <Section title={tp("tab_history")}>
            <ol className={classes.list}>{rows}</ol>
            {list.length === 0 && <Hint>{tp("history_empty")}</Hint>}
        </Section>
    );
}
