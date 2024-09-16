import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
const styles = theme => ({
    loader: {
        left: "50%",
        top: "50%",
        position: "fixed",
        transform: "translate(-50%, -50%)",
        "& #spinner": {
            boxSizing: "border-box",
            stroke: "#ffffff",
            strokeWidth: "6px",
            transformOrigin: "50%",
            animation: "$line 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite, $rotate 1.6s linear infinite"
        },
        "@global": {
            "@keyframes rotate": {
                "0%": {
                    transform: "rotate(0)",
                },
                "100%": {
                    transform: "rotate(450deg)",
                }
            },
            "@keyframes line": {
                "0%": {
                    strokeDasharray: "2, 85.964",
                    transform: "rotate(0deg)"
                },
                "50%": {
                    strokeDasharray: "65.973, 21.9911",
                    strokeDashoffset: "0"
                },
                "100%": {
                    strokeDasharray: "2, 85.964",
                    strokeDashoffset: "-65.973",
                    transform: "rotate(90deg)"
                }
            }
        }
    }
});

class Loader extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes
        };
    };

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        return false;
    }

    render() {

        const { classes } = this.state;

        return (
            <div className={classes.loader}>
                <svg viewBox="0 0 64 64" width="84" height="84">
                    <circle id="spinner" cx="32" cy="32" r="28" fill="none"></circle>
                </svg>
            </div>
        );
    }
}

export default withStyles(styles)(Loader);