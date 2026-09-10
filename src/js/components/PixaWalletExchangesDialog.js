import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import ButtonBase from "@material-ui/core/ButtonBase";
import CloseRounded from "@material-ui/icons/CloseRounded";
import { t } from "../utils/text";
import { withLanguage } from "../utils/withLanguage";

// Platforms where the tokens can be traded or converted. One entry per platform:
//   id       stable key
//   name     label shown under the logo
//   url      opened in a new tab (http(s) only). Leave it out for a platform that
//            is not live yet: the tile then renders dimmed and non-clickable.
//   logo     an SVG icon component (like the exports of ../icons/*) or an image
//            URL string. Without it the tile shows a monogram of the name.
//   caption  optional short line under the name (trading pair, "Coming soon", …)
//
// The list can also be supplied at render time through the `exchanges` prop.
export const EXCHANGES = [
    {
        id: "coinstore",
        name: "COINSTOIRE",
        url: "https://coinstore.com",
        logo: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHN0eWxlPSJpc29sYXRpb246aXNvbGF0ZSIgdmlld0JveD0iMCAwIDU1NSA1NTQiPjxkZWZzPjxjbGlwUGF0aCBpZD0iYSI+PHBhdGggZD0iTTAgMGg1NTV2NTU0SDB6Ii8+PC9jbGlwUGF0aD48L2RlZnM+PGcgY2xpcC1wYXRoPSJ1cmwoI2EpIj48cGF0aCBmaWxsPSIjZmZmIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0yNzkgM2MyMCAwIDM3IDE3IDM3IDM3djE3MGEzNyAzNyAwIDEgMS03NCAwVjQwYzAtMjAgMTYtMzcgMzctMzdtMTQ5IDE0N2EzNSAzNSAwIDEgMSA0OC01MCAxNjEgMTYxIDAgMCAxIDI5IDM2IDIxNSAyMTUgMCAwIDEgMjggNjcgMjk1IDI5NSAwIDAgMSA2IDEyMyAzMDIgMzAyIDAgMCAxLTI5IDkxIDI0NiAyNDYgMCAwIDEtNjIgNzcgMjI4IDIyOCAwIDAgMS05OSA0NSAyODcgMjg3IDAgMCAxLTYyIDdoLTNhMzUxIDM1MSAwIDAgMS05MC0xMiAyNjYgMjY2IDAgMCAxLTczLTM2IDIzOCAyMzggMCAwIDEtODktMTE2IDI2OCAyNjggMCAwIDEtMTItMTQ2IDI3MSAyNzEgMCAwIDEgMzgtOTVxMTUtMjMgMzQtNDFhMzUgMzUgMCAwIDEgNDggNTAgMTY5IDE2OSAwIDAgMC00MSA2MiAyMDEgMjAxIDAgMCAwLTExIDExMSAxOTkgMTk5IDAgMCAwIDI0IDY2IDE3MiAxNzIgMCAwIDAgMTIzIDgzIDI0NSAyNDUgMCAwIDAgNDkgNGgzYTI1NiAyNTYgMCAwIDAgNjgtMTEgMTcxIDE3MSAwIDAgMCA0OS0yNiAxNTggMTU4IDAgMCAwIDQ0LTU0IDIwNCAyMDQgMCAwIDAgMjItNjkgMjUyIDI1MiAwIDAgMC0xNy0xMjlsLTE2LTI3eiIvPjwvZz48L3N2Zz4=",
        caption: "PXA / USDT"
    },
];

const TRANSITION = "250ms cubic-bezier(0.4, 0, 0.2, 1) 5ms";

const styles = theme => ({
    paper: {
        "&.MuiDialog-paper": {
            backgroundColor: "#0e0e0e",
            backgroundImage: "none",
            color: "#ffffff",
            borderRadius: "32px",
            overflow: "hidden",
            [theme.breakpoints.down("xs")]: {
                margin: "16px",
                width: "calc(100% - 32px)",
                maxHeight: "calc(100% - 32px)",
                borderRadius: "24px",
            },
        },
    },
    title: {
        "&.MuiDialogTitle-root": {
            position: "relative",
            padding: "28px 76px 4px 28px",
            [theme.breakpoints.down("xs")]: {
                padding: "22px 64px 4px 20px",
            },
        },
    },
    heading: {
        margin: 0,
        fontWeight: 600,
        color: "#ffffff",
    },
    subtitle: {
        margin: "4px 0px 0px 0px",
        color: "#999999",
    },
    closeButton: {
        position: "absolute",
        right: 20,
        top: 20,
        color: "#c0c0c0",
        backgroundColor: "#151515",
        transition: `background-color ${TRANSITION}, color ${TRANSITION}`,
        "&:hover": {
            backgroundColor: "#212121",
            color: "#ffffff",
        },
        [theme.breakpoints.down("xs")]: {
            right: 12,
            top: 14,
        },
    },
    content: {
        "&.MuiDialogContent-root": {
            padding: "16px 28px 28px 28px",
            [theme.breakpoints.down("xs")]: {
                padding: "12px 16px 20px 16px",
            },
        },
    },
    // Two columns on phones, three on small screens, four from medium up.
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gridAutoRows: "1fr",
        gap: "12px",
        [theme.breakpoints.up("sm")]: {
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        },
        [theme.breakpoints.up("md")]: {
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        },
    },
    tile: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        width: "100%",
        minHeight: 148,
        padding: "20px 12px",
        borderRadius: 18,
        backgroundColor: "#000000",
        color: "#ffffff",
        textAlign: "center",
        textDecoration: "none",
        cursor: "pointer",
        transition: `border-color ${TRANSITION}`,
        "&:hover": {
            borderColor: "#404040",
        },
        "&.Mui-focusVisible": {
            borderColor: "#404040",
            outlineOffset: 2,
        },
    },
    tileInactive: {
        cursor: "default",
        opacity: 0.45,
        "&:hover": {
            borderColor: "#1c1c1c",
        },
    },
    logo: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 56,
        height: 56,
        marginBottom: 12,
        flexShrink: 0,
    },
    logoImage: {
        display: "block",
        maxWidth: "100%",
        maxHeight: "100%",
        width: "auto",
        height: "auto",
    },
    logoSvg: {
        width: 56,
        height: 56,
    },
    monogram: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 56,
        height: 56,
        borderRadius: "50%",
        backgroundColor: "#151515",
        color: "#d0d0d0",
        fontSize: 22,
        fontWeight: 600,
        lineHeight: 1,
    },
    label: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minWidth: 0,
        maxWidth: "100%",
    },
    name: {
        color: "#e6e6e6",
        fontWeight: 600,
        lineHeight: 1.3,
        overflowWrap: "anywhere",
    },
    caption: {
        marginTop: 2,
        color: "#666666",
        lineHeight: 1.4,
    },
    empty: {
        padding: "40px 16px",
        borderRadius: 18,
        border: "1px dashed #222222",
        backgroundColor: "#000000",
        color: "#777777",
        textAlign: "center",
    },
});

// Only http(s) links leave the app; anything else renders as a static tile.
function safeHref(url) {
    if (typeof url !== "string") return null;
    const trimmed = url.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function monogram(name) {
    const s = String(name || "").trim();
    return s ? s.charAt(0).toUpperCase() : "?";
}

class PixaWalletExchangesDialog extends React.Component {

    _render_logo = (exchange) => {
        const { classes } = this.props;
        const { logo, name } = exchange;
        if (typeof logo === "string" && logo.length) {
            return <img src={logo} alt="" loading="lazy" draggable={false} className={classes.logoImage}/>;
        }
        if (logo) {
            const Logo = logo;
            return <Logo className={classes.logoSvg}/>;
        }
        return <span className={classes.monogram} aria-hidden="true">{monogram(name)}</span>;
    };

    _render_tile = (exchange, index) => {
        const { classes } = this.props;
        const key = exchange.id || exchange.name || index;
        const href = safeHref(exchange.url);
        const body = (
            <React.Fragment>
                <span className={classes.logo}>{this._render_logo(exchange)}</span>
                <span className={classes.label}>
                    <Typography component="span" variant="body2" className={classes.name}>{exchange.name}</Typography>
                    {exchange.caption ? <Typography component="span" variant="caption" className={classes.caption}>{exchange.caption}</Typography> : null}
                </span>
            </React.Fragment>
        );

        if (!href) {
            return <div key={key} className={`${classes.tile} ${classes.tileInactive}`}>{body}</div>;
        }

        return (
            <ButtonBase
                key={key}
                component="a"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={classes.tile}
                focusRipple
            >
                {body}
            </ButtonBase>
        );
    };

    render() {
        const { classes, open, onClose } = this.props;
        const exchanges = Array.isArray(this.props.exchanges) ? this.props.exchanges : EXCHANGES;

        return (
            <Dialog
                open={Boolean(open)}
                onClose={onClose}
                maxWidth="sm"
                fullWidth
                PaperProps={{className: classes.paper}}
                aria-labelledby="pixa-wallet-exchanges-title"
            >
                <DialogTitle disableTypography className={classes.title}>
                    <Typography id="pixa-wallet-exchanges-title" component="h2" variant="h5" className={classes.heading}>{t("components.pixa_wallet_exchanges_dialog.title")}</Typography>
                    <Typography component="p" variant="body2" className={classes.subtitle}>{t("components.pixa_wallet_exchanges_dialog.subtitle")}</Typography>
                    <IconButton onClick={onClose} size="small" className={classes.closeButton} aria-label={t("components.pixa_wallet_exchanges_dialog.close")}><CloseRounded/></IconButton>
                </DialogTitle>
                <DialogContent className={classes.content}>
                    {exchanges.length ? (
                        <div className={classes.grid}>
                            {exchanges.map(this._render_tile)}
                        </div>
                    ) : (
                        <div className={classes.empty}>
                            <Typography component="p" variant="body2">{t("components.pixa_wallet_exchanges_dialog.empty")}</Typography>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(PixaWalletExchangesDialog));
