import * as React from "preact/compat";
import ButtonBase from "@material-ui/core/ButtonBase";

// ── ChipLink ─────────────────────────────────────────────────────────────────
// The root of a Chip that is a link (utils/link):
//
//   <Chip component={ChipLink} label={"#" + tag} {...link(href, onOpen)} />
//
// MUI's Chip wraps itself in ButtonBase only as its own default root, and as
// a <div>: handed component="a" it renders a bare <a> instead and loses the
// ripple, the focus ring and the clickable-chip look theme/overrides gives
// ".MuiButtonBase-root.MuiChip-root". This is that same ButtonBase, as an
// <a>, so a tag chip looks and answers exactly as it did. The role="button"
// Chip puts on a clickable chip is dropped: with an href it is a link, and
// ButtonBase restores the role by itself when there is none.
const ChipLink = React.forwardRef(function ChipLink({ role, ...rest }, ref) {
    return <ButtonBase component="a" ref={ref} {...rest} />;
});

export default ChipLink;
