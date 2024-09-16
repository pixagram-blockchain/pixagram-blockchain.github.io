import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Checkbox from '@material-ui/core/Checkbox';
import TextField from "@material-ui/core/TextField";
import ButtonBase from "@material-ui/core/ButtonBase";
import { cssBackgroundImage } from "../utils/safeUrl";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
const styles = theme => ({
    dialogContent: {
        margin: "12px 0px 24px 0px"
    },
    textFieldWrapper: {
        width: "100%",
        boxSizing: "border-box",
        margin: "8px 0px 16px 0px"
    },
    witnessTableWrapper: {
        overflowX: "auto",
        touchAction: "manipulation",
        contain: "style layout",
        "-webkit-overflow-scrolling": "touch"
    },
    witnessTable: {
        width: "100%",
        minWidth: "700px",
        borderCollapse: "collapse",
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(1),
        fontSize: "0.875rem",
        "& tr > th": {
            backgroundColor: "#191919",
            padding: theme.spacing(1.5),
            textAlign: "left",
            fontWeight: 600,
            borderBottom: `0px solid #ffffff12`,
            transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        },
        "& tr:hover > th": {
            backgroundColor: "#222",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        },
        "& tr > th:first-child": {
            borderRadius: "16px 0px 0px 0px"
        },
        "& tr > th:last-child": {
            borderRadius: "0px 16px 0px 0px",
        },
        "& tr > td": {
            backgroundColor: "transparent",
            transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        },
        "& tr:hover > td": {
            backgroundColor: "#171717",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        },
        "& tr:last-child > td:first-child": {
            borderRadius: "0px 0px 0px 16px"
        },
        "& tr:last-child > td:last-child": {
            borderRadius: "0px 0px 16px 0px",
        },
        "& td": {
            padding: "4px 12px",
            borderBottom: `1px solid #ffffff12`
        },
        "& tr:last-child td": {
            borderBottom: "0px"
        },
        "& tbody": {
            backgroundColor: "#101010"
        }
    }
});

class WitnessesView extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            customWitness: ""
        };
    }

    _handleTableTouchStart = (e) => {
        e.stopPropagation();
    }

    _handleCustomWitnessChange = (e) => {
        this.setState({ customWitness: e.target.value });
    }

    _handleVoteForAccount = () => {
        const { customWitness } = this.state;
        if (customWitness) {
            console.log("Voting for:", customWitness);
            // Implement vote logic
        }
    }

    _handleDelegateVote = () => {
        const { customWitness } = this.state;
        if (customWitness) {
            console.log("Delegating vote to:", customWitness);
            // Implement delegation logic
        }
    }

    render() {
        const { classes, authors } = this.props;

        return (
            <DialogContent scroll={"paper"} className={classes.dialogContent}>
                <Typography component={"h2"} variant={"h6"} style={{ marginTop: 12 }}>{t("components.witnesses_view.voting")}</Typography>
                <p>{t("words.you_can_delegate_your_vote_if_you")}</p>
                <div className={classes.textFieldWrapper}>
                    <TextField
                        id="custom-witness"
                        label={t("words.username_2")}
                        variant="outlined"
                        fullWidth
                        value={this.state.customWitness}
                        onChange={this._handleCustomWitnessChange}
                    />
                </div>
                <div style={{ textAlign: "right" }}>
                    <Button onClick={this._handleVoteForAccount}>{t("words.vote_for_account")}</Button>
                    <Button onClick={this._handleDelegateVote}>{t("words.delegate_my_vote")}</Button>
                </div>
                <Typography component={"h2"} variant={"h6"} style={{ marginTop: 12 }}>{t("words.top_witnesses")}</Typography>
                <p>{t("components.witnesses_view.you_can_vote_for_up_to_30")}</p>
                <div
                    className={classes.witnessTableWrapper}
                    onTouchStart={this._handleTableTouchStart}
                    onTouchMove={this._handleTableTouchStart}
                >
                    <table className={classes.witnessTable}>
                        <thead>
                        <tr style={{ textAlign: "left" }}>
                            <th>{t("words.rank")}</th>
                            <th>{t("words.witness")}</th>
                            <th>{t("words.version")}</th>
                            <th>{t("words.votes")}</th>
                            <th>{t("words.last_block")}</th>
                            <th>{t("words.miss")}</th>
                            <th>{t("words.price_feed")}</th>
                            <th>{t("words.voted")}</th>
                        </tr>
                        </thead>
                        <tbody>
                        {Object.values(authors).map((value, index) => {
                            const labelId = `checkbox-list-secondary-label-${value.username}`;

                            return (
                                <tr key={index}>
                                    <td style={{ fontFamily: `'Geist Mono'`, fontWeight: "bold" }}>
                                        #{index + 1}
                                    </td>
                                    <td style={{ display: "flex", gap: 8 }}>
                                        <ButtonBase style={{ margin: "8px 8px 8px 0px", borderRadius: "12px" }}>
                                            <div
                                                className={"pixelated"}
                                                style={{
                                                    backgroundSize: "cover",
                                                    backgroundImage: cssBackgroundImage(value.image),
                                                    width: 42,
                                                    height: 42,
                                                    borderRadius: "12px"
                                                }}
                                            />
                                        </ButtonBase>
                                        <div style={{ marginLeft: 8 }}>
                                            <strong style={{
                                                display: "block",
                                                fontSize: "14px",
                                                fontFamily: `'Industry Book'`
                                            }}>
                                                {`@${value.username}`}
                                            </strong>
                                            <span style={{
                                                marginTop: "4px",
                                                color: "#999",
                                                display: "block",
                                                fontSize: "11px",
                                                fontFamily: `'Normative Pro'`
                                            }}>
                                                    {`${value.description}`}
                                                </span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{
                                            margin: "8px",
                                            padding: "4px 8px",
                                            borderRadius: "8px",
                                            backgroundColor: "#333",
                                            color: "fff",
                                            fontWeight: "bold",
                                            fontFamily: "'Geist Mono'"
                                        }}>
                                            1.28.3
                                        </div>
                                    </td>
                                    <td style={{ fontFamily: `'Geist Mono'` }}>89</td>
                                    <td>
                                        <div style={{ fontSize: "12px", fontFamily: "'Geist Mono'" }}>#906738</div>
                                        <div style={{ fontSize: "8px" }}>{t("components.witnesses_view.1_second_ago")}</div>
                                    </td>
                                    <td style={{ fontFamily: `'Geist Mono'` }}>89</td>
                                    <td style={{ fontFamily: `'Geist Mono'` }}>$0.25</td>
                                    <td>
                                        <Checkbox
                                            edge="end"
                                            inputProps={{ 'aria-labelledby': labelId }}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            </DialogContent>
        );
    }
}

export default withLanguage(withStyles(styles)(WitnessesView));