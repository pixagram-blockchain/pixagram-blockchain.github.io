import React from 'react';
import {
    Menu,
    Slider,
    Typography,
    IconButton,
    makeStyles,
} from '@material-ui/core';
import CheckIcon from '@material-ui/icons/Check';
import InfoRounded from "@material-ui/icons/InfoRounded";
import InfoOutlined from "@material-ui/icons/InfoOutlined";

import { t } from "../utils/text";

const useStyles = makeStyles((theme) => ({
    menuContent: {
        margin: "24px 32px",
        width: 320,
    },
    sliderLabel: {
        marginBottom: theme.spacing(2),
        userSelect: "none",
        fontWeight: "bold",
        fontFamily: '"Industry Book", "Normative Pro"',

    },
    sliderSubLabel: {
        marginTop: theme.spacing(2),
        userSelect: "none",
        color: "#999"
    },
    slider: {
        float: "left",
        userSelect: "none",
    },
    validateButton: {
        "& .MuiIconButton-colorPrimary": {
            backgroundColor: "#eee !important",
            borderRadius: "50%",
            marginLeft: 16,
        },
        marginLeft: 16,
        float: "right"
    },
}));

const seedWordOptions = [
    { value: 128, label: '12' },
    { value: 160, label: '15' },
    { value: 192, label: '18' },
    { value: 224, label: '21' },
    { value: 256, label: '24' },
];

export default function SeedPhraseMenu({ anchorEl, onClose, onGenerate }) {
    const classes = useStyles();
    const [entropy, setEntropy] = React.useState(128);

    const handleGenerate = () => {
        if (onGenerate) onGenerate(entropy);
        if (onClose) onClose();
    };

    return (
        <Menu
            anchorEl={anchorEl}
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
            }}
            transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
            keepMounted
            open={Boolean(anchorEl)}
            onClose={onClose}
        >
            <div className={classes.menuContent}>
                <Typography className={classes.sliderLabel} variant={"body1"}>
                    {t("components.seed_phrase_menu.entropy_selection")}
                </Typography>
                <div style={{display: "flex"}}>
                    <Slider
                        className={classes.slider}
                        value={entropy}
                        onChange={(e, val) => setEntropy(val)}
                        aria-labelledby="seed-slider"
                        valueLabelDisplay="auto"
                        marks={seedWordOptions}
                        valueLabelFormat={(s) => s+"b"}
                        min={128}
                        max={256}
                        step={null}
                    />
                    <div className={classes.validateButton}>
                        <IconButton onClick={handleGenerate} color="primary">
                            <CheckIcon />
                        </IconButton>
                    </div>
                </div>
                <Typography className={classes.sliderSubLabel} variant={"body1"}>
                    {t("components.seed_phrase_menu.the_entropy_of_bits_results_in_a", {
                        entropy: entropy,
                        value: entropy === 128 ? "12": entropy === 160 ? "15": entropy === 192 ? "18": entropy === 224 ? "21": "24"
                    })}
                    <InfoOutlined style={{margin: "0px 0px -8px 8px", color: "#999"}}/>
                </Typography>
            </div>
        </Menu>
    );
}
