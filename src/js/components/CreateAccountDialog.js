import * as React from "preact/compat";
import { memo, useCallback, useMemo, useState, useEffect, useRef } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import FormControl from "@material-ui/core/FormControl";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import InputLabel from "@material-ui/core/InputLabel";
import InputAdornment from "@material-ui/core/InputAdornment";
import SwipeableViews from 'react-swipeable-views';
import Typography from "@material-ui/core/Typography";
import AccountRemove from "../icons/AccountRemove";
import AccountQuestion from "../icons/AccountQuestion";
import AccountAlert from "../icons/AccountAlert";
import AccountCheck from "../icons/AccountCheck";
import OutlinedInput from "@material-ui/core/OutlinedInput";
import CircularProgress from "@material-ui/core/CircularProgress";
import IconButton from "@material-ui/core/IconButton";
import Box from "@material-ui/core/Box";
import JSLoader from "../utils/JSLoader";
import {validateUsername, generateMnemonic, generateMasterKey, generatePDF, getWordsPossible} from "../utils/BackUpWallet2";
import Collapse from "@material-ui/core/Collapse";
import ChipInput from "./ChipInput";
import SeedPhraseMenu from "./SeedPhraseMenu";
import TermsOfUse from "./TermsOfUse";
import PrivacyPolicy from "./PrivacyPolicy";
import SeedPlus from "../icons/SeedPlus";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import Step from "@material-ui/core/Step";
import StepLabel from "@material-ui/core/StepLabel";
import Stepper from "@material-ui/core/Stepper";
import Fade from "@material-ui/core/Fade";
import PhoneIcon from '@material-ui/icons/Phone';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import SendIcon from '@material-ui/icons/Send';
import ExpandMoreIcon from '@material-ui/icons/ExpandMoreRounded';
import Tooltip from "@material-ui/core/Tooltip";
import Link from "@material-ui/core/Link";
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";
import * as actions from "../actions/utils";

import getIT from "../data/pixaLogoWhite";
import { t, getLocaleCode, getLanguage, useLanguage } from "../utils/text";
import { withLanguage } from "../utils/withLanguage";

// =============================================================================
// Country flags (Noto emoji SVG components) for the phone dial-code adornment.
// One import per ISO2 code present in PHONE_MASKS below; FLAG_BY_COUNTRY maps
// the code to its component. Same pattern as constant_locales.js.
// =============================================================================
import FlagAC from "../notoemoji/react/EmojiU1F1E61F1E8";
import FlagAD from "../notoemoji/react/EmojiU1F1E61F1E9";
import FlagAE from "../notoemoji/react/EmojiU1F1E61F1Ea";
import FlagAF from "../notoemoji/react/EmojiU1F1E61F1Eb";
import FlagAG from "../notoemoji/react/EmojiU1F1E61F1Ec";
import FlagAI from "../notoemoji/react/EmojiU1F1E61F1Ee";
import FlagAL from "../notoemoji/react/EmojiU1F1E61F1F1";
import FlagAM from "../notoemoji/react/EmojiU1F1E61F1F2";
import FlagAO from "../notoemoji/react/EmojiU1F1E61F1F4";
import FlagAQ from "../notoemoji/react/EmojiU1F1E61F1F6";
import FlagAR from "../notoemoji/react/EmojiU1F1E61F1F7";
import FlagAS from "../notoemoji/react/EmojiU1F1E61F1F8";
import FlagAT from "../notoemoji/react/EmojiU1F1E61F1F9";
import FlagAU from "../notoemoji/react/EmojiU1F1E61F1Fa";
import FlagAW from "../notoemoji/react/EmojiU1F1E61F1Fc";
import FlagAZ from "../notoemoji/react/EmojiU1F1E61F1Ff";
import FlagBA from "../notoemoji/react/EmojiU1F1E71F1E6";
import FlagBB from "../notoemoji/react/EmojiU1F1E71F1E7";
import FlagBD from "../notoemoji/react/EmojiU1F1E71F1E9";
import FlagBE from "../notoemoji/react/EmojiU1F1E71F1Ea";
import FlagBF from "../notoemoji/react/EmojiU1F1E71F1Eb";
import FlagBG from "../notoemoji/react/EmojiU1F1E71F1Ec";
import FlagBH from "../notoemoji/react/EmojiU1F1E71F1Ed";
import FlagBI from "../notoemoji/react/EmojiU1F1E71F1Ee";
import FlagBJ from "../notoemoji/react/EmojiU1F1E71F1Ef";
import FlagBM from "../notoemoji/react/EmojiU1F1E71F1F2";
import FlagBN from "../notoemoji/react/EmojiU1F1E71F1F3";
import FlagBO from "../notoemoji/react/EmojiU1F1E71F1F4";
import FlagBR from "../notoemoji/react/EmojiU1F1E71F1F7";
import FlagBS from "../notoemoji/react/EmojiU1F1E71F1F8";
import FlagBT from "../notoemoji/react/EmojiU1F1E71F1F9";
import FlagBW from "../notoemoji/react/EmojiU1F1E71F1Fc";
import FlagBY from "../notoemoji/react/EmojiU1F1E71F1Fe";
import FlagBZ from "../notoemoji/react/EmojiU1F1E71F1Ff";
import FlagCA from "../notoemoji/react/EmojiU1F1E81F1E6";
import FlagCD from "../notoemoji/react/EmojiU1F1E81F1E9";
import FlagCF from "../notoemoji/react/EmojiU1F1E81F1Eb";
import FlagCG from "../notoemoji/react/EmojiU1F1E81F1Ec";
import FlagCH from "../notoemoji/react/EmojiU1F1E81F1Ed";
import FlagCI from "../notoemoji/react/EmojiU1F1E81F1Ee";
import FlagCK from "../notoemoji/react/EmojiU1F1E81F1F0";
import FlagCL from "../notoemoji/react/EmojiU1F1E81F1F1";
import FlagCM from "../notoemoji/react/EmojiU1F1E81F1F2";
import FlagCN from "../notoemoji/react/EmojiU1F1E81F1F3";
import FlagCO from "../notoemoji/react/EmojiU1F1E81F1F4";
import FlagCR from "../notoemoji/react/EmojiU1F1E81F1F7";
import FlagCU from "../notoemoji/react/EmojiU1F1E81F1Fa";
import FlagCV from "../notoemoji/react/EmojiU1F1E81F1Fb";
import FlagCW from "../notoemoji/react/EmojiU1F1E81F1Fc";
import FlagCY from "../notoemoji/react/EmojiU1F1E81F1Fe";
import FlagCZ from "../notoemoji/react/EmojiU1F1E81F1Ff";
import FlagDE from "../notoemoji/react/EmojiU1F1E91F1Ea";
import FlagDJ from "../notoemoji/react/EmojiU1F1E91F1Ef";
import FlagDK from "../notoemoji/react/EmojiU1F1E91F1F0";
import FlagDM from "../notoemoji/react/EmojiU1F1E91F1F2";
import FlagDO from "../notoemoji/react/EmojiU1F1E91F1F4";
import FlagDZ from "../notoemoji/react/EmojiU1F1E91F1Ff";
import FlagEC from "../notoemoji/react/EmojiU1F1Ea1F1E8";
import FlagEE from "../notoemoji/react/EmojiU1F1Ea1F1Ea";
import FlagEG from "../notoemoji/react/EmojiU1F1Ea1F1Ec";
import FlagER from "../notoemoji/react/EmojiU1F1Ea1F1F7";
import FlagES from "../notoemoji/react/EmojiU1F1Ea1F1F8";
import FlagET from "../notoemoji/react/EmojiU1F1Ea1F1F9";
import FlagFI from "../notoemoji/react/EmojiU1F1Eb1F1Ee";
import FlagFJ from "../notoemoji/react/EmojiU1F1Eb1F1Ef";
import FlagFK from "../notoemoji/react/EmojiU1F1Eb1F1F0";
import FlagFM from "../notoemoji/react/EmojiU1F1Eb1F1F2";
import FlagFO from "../notoemoji/react/EmojiU1F1Eb1F1F4";
import FlagFR from "../notoemoji/react/EmojiU1F1Eb1F1F7";
import FlagGA from "../notoemoji/react/EmojiU1F1Ec1F1E6";
import FlagGD from "../notoemoji/react/EmojiU1F1Ec1F1E9";
import FlagGE from "../notoemoji/react/EmojiU1F1Ec1F1Ea";
import FlagGF from "../notoemoji/react/EmojiU1F1Ec1F1Eb";
import FlagGH from "../notoemoji/react/EmojiU1F1Ec1F1Ed";
import FlagGI from "../notoemoji/react/EmojiU1F1Ec1F1Ee";
import FlagGL from "../notoemoji/react/EmojiU1F1Ec1F1F1";
import FlagGM from "../notoemoji/react/EmojiU1F1Ec1F1F2";
import FlagGN from "../notoemoji/react/EmojiU1F1Ec1F1F3";
import FlagGQ from "../notoemoji/react/EmojiU1F1Ec1F1F6";
import FlagGR from "../notoemoji/react/EmojiU1F1Ec1F1F7";
import FlagGT from "../notoemoji/react/EmojiU1F1Ec1F1F9";
import FlagGU from "../notoemoji/react/EmojiU1F1Ec1F1Fa";
import FlagGW from "../notoemoji/react/EmojiU1F1Ec1F1Fc";
import FlagGY from "../notoemoji/react/EmojiU1F1Ec1F1Fe";
import FlagHK from "../notoemoji/react/EmojiU1F1Ed1F1F0";
import FlagHN from "../notoemoji/react/EmojiU1F1Ed1F1F3";
import FlagHR from "../notoemoji/react/EmojiU1F1Ed1F1F7";
import FlagHT from "../notoemoji/react/EmojiU1F1Ed1F1F9";
import FlagHU from "../notoemoji/react/EmojiU1F1Ed1F1Fa";
import FlagID from "../notoemoji/react/EmojiU1F1Ee1F1E9";
import FlagIE from "../notoemoji/react/EmojiU1F1Ee1F1Ea";
import FlagIL from "../notoemoji/react/EmojiU1F1Ee1F1F1";
import FlagIN from "../notoemoji/react/EmojiU1F1Ee1F1F3";
import FlagIO from "../notoemoji/react/EmojiU1F1Ee1F1F4";
import FlagIQ from "../notoemoji/react/EmojiU1F1Ee1F1F6";
import FlagIR from "../notoemoji/react/EmojiU1F1Ee1F1F7";
import FlagIS from "../notoemoji/react/EmojiU1F1Ee1F1F8";
import FlagIT from "../notoemoji/react/EmojiU1F1Ee1F1F9";
import FlagJM from "../notoemoji/react/EmojiU1F1Ef1F1F2";
import FlagJO from "../notoemoji/react/EmojiU1F1Ef1F1F4";
import FlagJP from "../notoemoji/react/EmojiU1F1Ef1F1F5";
import FlagKE from "../notoemoji/react/EmojiU1F1F01F1Ea";
import FlagKG from "../notoemoji/react/EmojiU1F1F01F1Ec";
import FlagKH from "../notoemoji/react/EmojiU1F1F01F1Ed";
import FlagKI from "../notoemoji/react/EmojiU1F1F01F1Ee";
import FlagKM from "../notoemoji/react/EmojiU1F1F01F1F2";
import FlagKN from "../notoemoji/react/EmojiU1F1F01F1F3";
import FlagKP from "../notoemoji/react/EmojiU1F1F01F1F5";
import FlagKR from "../notoemoji/react/EmojiU1F1F01F1F7";
import FlagKW from "../notoemoji/react/EmojiU1F1F01F1Fc";
import FlagKY from "../notoemoji/react/EmojiU1F1F01F1Fe";
import FlagKZ from "../notoemoji/react/EmojiU1F1F01F1Ff";
import FlagLA from "../notoemoji/react/EmojiU1F1F11F1E6";
import FlagLB from "../notoemoji/react/EmojiU1F1F11F1E7";
import FlagLC from "../notoemoji/react/EmojiU1F1F11F1E8";
import FlagLI from "../notoemoji/react/EmojiU1F1F11F1Ee";
import FlagLK from "../notoemoji/react/EmojiU1F1F11F1F0";
import FlagLR from "../notoemoji/react/EmojiU1F1F11F1F7";
import FlagLS from "../notoemoji/react/EmojiU1F1F11F1F8";
import FlagLT from "../notoemoji/react/EmojiU1F1F11F1F9";
import FlagLU from "../notoemoji/react/EmojiU1F1F11F1Fa";
import FlagLV from "../notoemoji/react/EmojiU1F1F11F1Fb";
import FlagLY from "../notoemoji/react/EmojiU1F1F11F1Fe";
import FlagMA from "../notoemoji/react/EmojiU1F1F21F1E6";
import FlagMC from "../notoemoji/react/EmojiU1F1F21F1E8";
import FlagMD from "../notoemoji/react/EmojiU1F1F21F1E9";
import FlagME from "../notoemoji/react/EmojiU1F1F21F1Ea";
import FlagMG from "../notoemoji/react/EmojiU1F1F21F1Ec";
import FlagMH from "../notoemoji/react/EmojiU1F1F21F1Ed";
import FlagMK from "../notoemoji/react/EmojiU1F1F21F1F0";
import FlagML from "../notoemoji/react/EmojiU1F1F21F1F1";
import FlagMM from "../notoemoji/react/EmojiU1F1F21F1F2";
import FlagMN from "../notoemoji/react/EmojiU1F1F21F1F3";
import FlagMO from "../notoemoji/react/EmojiU1F1F21F1F4";
import FlagMP from "../notoemoji/react/EmojiU1F1F21F1F5";
import FlagMQ from "../notoemoji/react/EmojiU1F1F21F1F6";
import FlagMR from "../notoemoji/react/EmojiU1F1F21F1F7";
import FlagMS from "../notoemoji/react/EmojiU1F1F21F1F8";
import FlagMT from "../notoemoji/react/EmojiU1F1F21F1F9";
import FlagMU from "../notoemoji/react/EmojiU1F1F21F1Fa";
import FlagMV from "../notoemoji/react/EmojiU1F1F21F1Fb";
import FlagMW from "../notoemoji/react/EmojiU1F1F21F1Fc";
import FlagMX from "../notoemoji/react/EmojiU1F1F21F1Fd";
import FlagMY from "../notoemoji/react/EmojiU1F1F21F1Fe";
import FlagMZ from "../notoemoji/react/EmojiU1F1F21F1Ff";
import FlagNA from "../notoemoji/react/EmojiU1F1F31F1E6";
import FlagNC from "../notoemoji/react/EmojiU1F1F31F1E8";
import FlagNE from "../notoemoji/react/EmojiU1F1F31F1Ea";
import FlagNF from "../notoemoji/react/EmojiU1F1F31F1Eb";
import FlagNG from "../notoemoji/react/EmojiU1F1F31F1Ec";
import FlagNI from "../notoemoji/react/EmojiU1F1F31F1Ee";
import FlagNL from "../notoemoji/react/EmojiU1F1F31F1F1";
import FlagNO from "../notoemoji/react/EmojiU1F1F31F1F4";
import FlagNP from "../notoemoji/react/EmojiU1F1F31F1F5";
import FlagNR from "../notoemoji/react/EmojiU1F1F31F1F7";
import FlagNU from "../notoemoji/react/EmojiU1F1F31F1Fa";
import FlagNZ from "../notoemoji/react/EmojiU1F1F31F1Ff";
import FlagOM from "../notoemoji/react/EmojiU1F1F41F1F2";
import FlagPA from "../notoemoji/react/EmojiU1F1F51F1E6";
import FlagPE from "../notoemoji/react/EmojiU1F1F51F1Ea";
import FlagPF from "../notoemoji/react/EmojiU1F1F51F1Eb";
import FlagPG from "../notoemoji/react/EmojiU1F1F51F1Ec";
import FlagPH from "../notoemoji/react/EmojiU1F1F51F1Ed";
import FlagPK from "../notoemoji/react/EmojiU1F1F51F1F0";
import FlagPL from "../notoemoji/react/EmojiU1F1F51F1F1";
import FlagPS from "../notoemoji/react/EmojiU1F1F51F1F8";
import FlagPT from "../notoemoji/react/EmojiU1F1F51F1F9";
import FlagPW from "../notoemoji/react/EmojiU1F1F51F1Fc";
import FlagPY from "../notoemoji/react/EmojiU1F1F51F1Fe";
import FlagQA from "../notoemoji/react/EmojiU1F1F61F1E6";
import FlagRE from "../notoemoji/react/EmojiU1F1F71F1Ea";
import FlagRO from "../notoemoji/react/EmojiU1F1F71F1F4";
import FlagRS from "../notoemoji/react/EmojiU1F1F71F1F8";
import FlagRU from "../notoemoji/react/EmojiU1F1F71F1Fa";
import FlagRW from "../notoemoji/react/EmojiU1F1F71F1Fc";
import FlagSA from "../notoemoji/react/EmojiU1F1F81F1E6";
import FlagSB from "../notoemoji/react/EmojiU1F1F81F1E7";
import FlagSC from "../notoemoji/react/EmojiU1F1F81F1E8";
import FlagSD from "../notoemoji/react/EmojiU1F1F81F1E9";
import FlagSE from "../notoemoji/react/EmojiU1F1F81F1Ea";
import FlagSG from "../notoemoji/react/EmojiU1F1F81F1Ec";
import FlagSH from "../notoemoji/react/EmojiU1F1F81F1Ed";
import FlagSI from "../notoemoji/react/EmojiU1F1F81F1Ee";
import FlagSK from "../notoemoji/react/EmojiU1F1F81F1F0";
import FlagSL from "../notoemoji/react/EmojiU1F1F81F1F1";
import FlagSM from "../notoemoji/react/EmojiU1F1F81F1F2";
import FlagSN from "../notoemoji/react/EmojiU1F1F81F1F3";
import FlagSO from "../notoemoji/react/EmojiU1F1F81F1F4";
import FlagSR from "../notoemoji/react/EmojiU1F1F81F1F7";
import FlagSS from "../notoemoji/react/EmojiU1F1F81F1F8";
import FlagST from "../notoemoji/react/EmojiU1F1F81F1F9";
import FlagSV from "../notoemoji/react/EmojiU1F1F81F1Fb";
import FlagSX from "../notoemoji/react/EmojiU1F1F81F1Fd";
import FlagSY from "../notoemoji/react/EmojiU1F1F81F1Fe";
import FlagSZ from "../notoemoji/react/EmojiU1F1F81F1Ff";
import FlagTC from "../notoemoji/react/EmojiU1F1F91F1E8";
import FlagTD from "../notoemoji/react/EmojiU1F1F91F1E9";
import FlagTG from "../notoemoji/react/EmojiU1F1F91F1Ec";
import FlagTH from "../notoemoji/react/EmojiU1F1F91F1Ed";
import FlagTJ from "../notoemoji/react/EmojiU1F1F91F1Ef";
import FlagTK from "../notoemoji/react/EmojiU1F1F91F1F0";
import FlagTL from "../notoemoji/react/EmojiU1F1F91F1F1";
import FlagTM from "../notoemoji/react/EmojiU1F1F91F1F2";
import FlagTN from "../notoemoji/react/EmojiU1F1F91F1F3";
import FlagTO from "../notoemoji/react/EmojiU1F1F91F1F4";
import FlagTR from "../notoemoji/react/EmojiU1F1F91F1F7";
import FlagTT from "../notoemoji/react/EmojiU1F1F91F1F9";
import FlagTV from "../notoemoji/react/EmojiU1F1F91F1Fb";
import FlagTW from "../notoemoji/react/EmojiU1F1F91F1Fc";
import FlagTZ from "../notoemoji/react/EmojiU1F1F91F1Ff";
import FlagUA from "../notoemoji/react/EmojiU1F1Fa1F1E6";
import FlagUG from "../notoemoji/react/EmojiU1F1Fa1F1Ec";
import FlagUK from "../notoemoji/react/EmojiU1F1Ec1F1E7";  // masks use "UK" — this is the GB flag
import FlagUS from "../notoemoji/react/EmojiU1F1Fa1F1F8";
import FlagUY from "../notoemoji/react/EmojiU1F1Fa1F1Fe";
import FlagUZ from "../notoemoji/react/EmojiU1F1Fa1F1Ff";
import FlagVA from "../notoemoji/react/EmojiU1F1Fb1F1E6";
import FlagVC from "../notoemoji/react/EmojiU1F1Fb1F1E8";
import FlagVE from "../notoemoji/react/EmojiU1F1Fb1F1Ea";
import FlagVG from "../notoemoji/react/EmojiU1F1Fb1F1Ec";
import FlagVI from "../notoemoji/react/EmojiU1F1Fb1F1Ee";
import FlagVN from "../notoemoji/react/EmojiU1F1Fb1F1F3";
import FlagVU from "../notoemoji/react/EmojiU1F1Fb1F1Fa";
import FlagWF from "../notoemoji/react/EmojiU1F1Fc1F1Eb";
import FlagWS from "../notoemoji/react/EmojiU1F1Fc1F1F8";
import FlagYE from "../notoemoji/react/EmojiU1F1Fe1F1Ea";
import FlagZA from "../notoemoji/react/EmojiU1F1Ff1F1E6";
import FlagZM from "../notoemoji/react/EmojiU1F1Ff1F1F2";
import FlagZW from "../notoemoji/react/EmojiU1F1Ff1F1Fc";

// Hoisted static styles — were inline literals re-created on every render.
const ST_POS_ABSOLUTE__RIGHT_16PX__BOT_24PX = { position: "absolute", right: "16px", bottom: "24px" };
const ST_MT_NEG8 = { marginTop: -8 };
const ST_FS_14PX__MB_16PX__MT_8PX = { fontSize: "14px", marginBottom: "16px", marginTop: "8px", color: "#9b9b9b", textAlign: "right" };
const ST_PT_8 = { paddingTop: 8 };
const ST_FS_14__MB_16__MT_8 = { fontSize: 14, marginBottom: 16, marginTop: 8, color: "#9b9b9b", textAlign: "left" };
const ST_FS_13__MB_24__C_7B7B7B = { fontSize: 13, marginBottom: 24, color: "#7b7b7b", textAlign: "left" };
const ST_TA_RIGHT = { textAlign: "right" };
const ST_FS_14__MT_16__C_BDBDBD = { fontSize: 14, marginTop: 16, color: "#bdbdbd", fontStyle: "italic", textAlign: "left" };
const ST_FS_14__MT_16__C_FFFFFF = { fontSize: 14, marginTop: 16, color: "#ffffff", textAlign: "left" };
const ST_C_FFFFFF = { color: "#ffffff" };
const ST_MR_8 = { marginRight: 8 };
const ST_CUR_POINTER = { cursor: "pointer" };
const ST_C_7B7B7B__MR_8__CUR_POINTER = { color: "#7b7b7b", marginRight: 8, cursor: "pointer" };
const ST_MB_16__MT_8 = { marginBottom: 16, marginTop: 8 };
const ST_MB_16 = { marginBottom: 16 };
const ST_MB_8 = { marginBottom: 8 };
const ST_DISPLAY_NONE = { display: "none" };
const ST_FS_12__MT_NEG8__MB_8 = { fontSize: 12, marginTop: -8, marginBottom: 8, color: "#7b7b7b", textAlign: "left" };
const ST_FS_14__MB_12__C_BDBDBD = { fontSize: 14, marginBottom: 12, color: "#bdbdbd", fontStyle: "italic", textAlign: "left" };
const ST_MT_8 = { marginTop: 8 };
const ST_FS_14__MT_12__C_BDBDBD = { fontSize: 14, marginTop: 12, color: "#bdbdbd", fontStyle: "italic" };
const ST_FS_14__MT_12__C_FFFFFF = { fontSize: 14, marginTop: 12, color: "#ffffff" };
const ST_PT_0 = { paddingTop: 0 };
const ST_FS_14__C_7B7B7B__P_12PX_4PX = { fontSize: 14, color: "#7b7b7b", padding: "12px 4px", fontStyle: "italic" };
const ST_C_BDBDBD__FS_14__TA_CENTER = { color: "#bdbdbd", fontSize: 14, textAlign: "center" };
const ST_C_FFF__FS_16__TA_CENTER = { color: "#fff", fontSize: 16, textAlign: "center" };
const ST_C_BDBDBD__FS_13__TA_CENTER = { color: "#bdbdbd", fontSize: 13, textAlign: "center", maxWidth: 420 };
const ST_C_BDBDBD__FSTY_ITALIC__FS_14 = { color: "#bdbdbd", fontStyle: "italic", fontSize: 14, textAlign: "center" };
const ST_W_100__MAXW_360PX__US_NONE = { width: "100%", maxWidth: "360px", userSelect: "none", pointerEvents: "none" };
const ST_W_360PX__FS_60PX__FW_400 = { width: "360px", fontSize: "60px", fontWeight: "400", margin: "-24px 16px 0px 16px" };
const ST_W_360PX__FS_20PX__FW_400 = { width: "360px", fontSize: "20px", fontWeight: "400", margin: "24px 16px" };
const ST_P_24PX = { padding: "24px" };
// Phones: the step names go under their circles (Stepper alternativeLabel),
// each in a third of the width, where they can wrap. Side by side they
// can't — one word each — and in 18 of the 27 languages GENERATE / VERIFY /
// CONFIRM came out wider than a 390 px screen (up to 482 px), which made the
// whole dialog wider than the screen and cut off its right edge.
const COMPACT_STEPPER_MAX_WIDTH = 599; // MUI's "xs"
const ST_STEPPER_COMPACT = { padding: "14px 4px 10px" };
const viewportWidth = () => window.innerWidth || document.documentElement.clientWidth ||
    (document.body || document.getElementsByTagName('body')[0]).clientWidth;
const ST_POS_ABSOLUTE__W_0__H_0 = { position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0, pointerEvents: 'none' };

// Agreement modal (step 0): one tab per legal document. Key paths only —
// t() must run inside render() so the labels follow the active locale.
const TERMS_MODAL_TITLE_KEYS = [
    "components.create_account_dialog.terms_of_use",
    "components.create_account_dialog.privacy_policy",
];

const pixaLogoWhite = getIT();

// =============================================================================
// CONFIGURATION
// =============================================================================

// Unified phone-verification + voucher + account-creation worker.
const ACCOUNT_SERVICE_API = "https://pixa-account-service.p1x4.workers.dev";

// Cloudflare Turnstile — the bot gate in front of /send-code (SMS-pumping
// defense, see docs/INTEGRATION-GUIDE.md §3.3b). Create the widget in the
// Cloudflare dashboard (Turnstile → Add widget, hostname pixagram.com, mode
// "Managed") and paste its SITE key here; the SECRET key goes to the worker
// (`wrangler secret put TURNSTILE_SECRET_KEY`). Empty = the dialog sends no
// token — matching a worker whose secret is unset. Deploy order: worker →
// this site key → worker secret. Cloudflare's test keys for local work:
// "1x00000000000000000000AA" (always passes) / "3x00000000000000000000FF"
// (forces a visible interactive challenge).
const TURNSTILE_SITE_KEY = "0x4AAAAAAFBNQ9Ess9iIWkVA";
const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
// If the challenge produces no token within this time (script blocked, slow
// network), the send goes out WITHOUT a token and the worker decides: a
// worker with the gate on answers TURNSTILE_REQUIRED, which is shown to the
// user; a worker with the gate off just sends.
const TURNSTILE_TIMEOUT_MS = 20000;

// Idempotent loader for the Turnstile script (explicit render mode).
let _turnstileLoading = null;
const loadTurnstile = () => {
    if (typeof window === "undefined") return Promise.reject(new Error("no window"));
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (_turnstileLoading) return _turnstileLoading;
    _turnstileLoading = new Promise((resolve, reject) => {
        const cb = "__pixaTurnstileOnload";
        window[cb] = () => resolve(window.turnstile);
        const s = document.createElement("script");
        s.src = `${TURNSTILE_SCRIPT}&onload=${cb}`;
        s.async = true;
        s.defer = true;
        s.onerror = () => { _turnstileLoading = null; reject(new Error("Turnstile script failed to load")); };
        document.head.appendChild(s);
    });
    return _turnstileLoading;
};

// SMS languages supported by the worker (mirrors its SUPPORTED_SMS_LANGS).
// The active UI language is sent with /send-code; anything else falls back
// to English server-side.
const SUPPORTED_SMS_LANGS = [
    "bn", "cs", "da", "de", "el", "en", "es", "fi", "fr", "hi", "hu", "id",
    "it", "ja", "ko", "nl", "no", "pl", "pt", "ro", "ru", "sk", "sv", "ta",
    "tr", "uk", "zh",
];
const toSmsLang = (raw) => {
    const lang = String(raw || "").toLowerCase().split("-")[0];
    return SUPPORTED_SMS_LANGS.indexOf(lang) !== -1 ? lang : "en";
};

// The account worker writes its error messages in English. In an English UI
// they are shown as they come (`workerText(json.error) || t(...)`); in any
// other language the dialog's own translation for that case is shown
// instead. Where the dialog has no text of its own for a case, the worker's
// message is kept in every language: it is the only detail there is.
const workerText = (text) => (/^en\b/i.test(String(getLanguage() || "en")) ? String(text || "") : "");

// Debounce for the pre-flight /check-phone call while the user types.
const PHONE_CHECK_DEBOUNCE_MS = 650;

// Every country offered in the picker is a supported SMS destination — the
// prefix set is DERIVED from PHONE_MASKS (defined below), so the picker,
// this check, and the worker's SMS_ALLOWED_PREFIXES describe one list.
// Bird's dashboard (SMS → Destinations) stays the delivery authority.
let _SUPPORTED_SMS_PREFIXES = null;
const supportedSmsPrefixes = () => {
    if (_SUPPORTED_SMS_PREFIXES) return _SUPPORTED_SMS_PREFIXES;
    const set = new Set();
    for (const [, mask] of PHONE_MASKS) {
        const m = /^\+(\d+)/.exec(mask);
        if (m) set.add("+" + m[1]);
    }
    _SUPPORTED_SMS_PREFIXES = Array.from(set);
    return _SUPPORTED_SMS_PREFIXES;
};

// Verdict for a dial code as typed. "unsupported" only once no supported
// prefix can still be reached — "+8" alone stays "maybe" (the user may be
// heading to +81), "+999" is a firm "unsupported".
const destSupport = (dialCode) => {
    const dest = "+" + String(dialCode || "").replace(/\D/g, "");
    if (dest.length < 2) return "maybe";
    for (const p of supportedSmsPrefixes()) {
        if (dest.startsWith(p)) return "supported";
        if (p.startsWith(dest)) return "maybe";
    }
    return "unsupported";
};

// 1-day session, matching LoginDialog's "1d" preset (24 * 60 minutes).
const SESSION_TIMEOUT_MIN = 24 * 60;
const PIN_TIMEOUT_MIN = 24 * 60;

// Signing a just-created account in: how long to keep asking the node to
// validate it before giving up, and how often (see _loginCurrentAccount).
const ACCOUNT_VISIBLE_TIMEOUT_MS = 15000;
const ACCOUNT_VISIBLE_RETRY_MS = 1500;
// api.validateCredentials answers that waiting can't change (pixaproxyapi.js,
// _doValidation). Any other refusal ('Account not found' while the node
// catches up with a new account, a failed request) is asked again.
const PERMANENT_VALIDATION_ERRORS = Object.freeze([
    "Master password does not match account keys",
    "Invalid account parameter",
]);

// (No auto-close on the final success screen anymore: a download the person
// cancelled went unnoticed and the dialog closed on an unsaved backup. The
// dialog now stays until the backup PDF is saved — see _mayClose.)

// =============================================================================
// Phone mask data — array of [ISO2, mask] tuples. Multiple masks per country
// are allowed (the JSON source had duplicate keys for variable-length numbers).
// We pick the mask that best fits the current input length on each keystroke.
//
// Invariant: every mask of one ISO2 carries the SAME dial code — the UI keeps
// one dial code per country (`dialCodeFor`). The JSON source filed France's
// overseas collectivities under "FR" (+262 Réunion, +508 Saint-Pierre-et-
// Miquelon, +590 Guadeloupe), which made `dialCodeFor("FR")` return the
// shortest of those masks, +508. They now live under their own ISO2 (RE,
// PM, GP); the set of dial codes offered is unchanged.
// =============================================================================
const PHONE_MASKS = [
    ["AC", "+247-####"], ["AD", "+376-###-###"], ["AE", "+971-5#-###-####"], ["AE", "+971-#-###-####"],
    ["AF", "+93-##-###-####"], ["AG", "+1(268)###-####"], ["AI", "+1(264)###-####"], ["AL", "+355(###)###-###"],
    ["AM", "+374-##-###-###"], ["AN", "+599-###-####"], ["AN", "+599-9###-####"], ["AO", "+244(###)###-###"],
    ["AQ", "+672-1##-###"], ["AR", "+54(###)###-####"], ["AR", "+54-9(##)####-####"], ["AS", "+1(684)###-####"], ["AT", "+43(###)###-####"], ["AT", "+43(###)###-#####"], ["AT", "+43(###)####-######"],
    ["AU", "+61-#-####-####"], ["AW", "+297-###-####"], ["AZ", "+994-##-###-##-##"], ["BA", "+387-##-#####"],
    ["BA", "+387-##-####"], ["BB", "+1(246)###-####"], ["BD", "+880-##-###-###"], ["BD", "+880-##-####-####"], ["BE", "+32-#-###-##-##"], ["BE", "+32(###)###-###"],
    ["BF", "+226-##-##-####"], ["BG", "+359(###)###-###"], ["BH", "+973-####-####"], ["BI", "+257-##-##-####"],
    ["BJ", "+229-##-##-####"], ["BJ", "+229-01-##-##-##-##"], ["BM", "+1(441)###-####"], ["BN", "+673-###-####"], ["BO", "+591-#-###-####"],
    ["BR", "+55(##)####-####"], ["BR", "+55(##)7###-####"], ["BR", "+55(##)9####-####"], ["BS", "+1(242)###-####"],
    ["BT", "+975-17-###-###"], ["BT", "+975-#-###-###"], ["BW", "+267-##-###-###"], ["BY", "+375(##)###-##-##"],
    ["BZ", "+501-###-####"], ["CA", "+1(###)###-####"], ["CD", "+243(###)###-###"], ["CF", "+236-##-##-####"],
    ["CG", "+242-##-###-####"], ["CH", "+41-##-###-####"], ["CI", "+225-##-###-###"], ["CI", "+225-##-##-##-##-##"], ["CK", "+682-##-###"],
    ["CL", "+56-#-####-####"], ["CM", "+237-####-####"], ["CM", "+237-#-##-##-##-##"], ["CN", "+86(###)####-####"], ["CN", "+86(###)####-###"],
    ["CN", "+86-##-#####-#####"], ["CO", "+57(###)###-####"], ["CR", "+506-####-####"], ["CU", "+53-#-###-####"],
    ["CV", "+238(###)##-##"], ["CW", "+599-###-####"], ["CY", "+357-##-###-###"], ["CZ", "+420(###)###-###"],
    ["DE", "+49(####)###-####"], ["DE", "+49(###)###-####"], ["DE", "+49(###)##-####"], ["DE", "+49(###)##-###"],
    ["DE", "+49(###)##-##"], ["DE", "+49-###-###"], ["DJ", "+253-##-##-##-##"], ["DK", "+45-##-##-##-##"],
    // DO has three area codes: written "-809-" (not "(809)") so the dial code
    // stays +1 and the area code is typed as part of the number, while a pasted
    // "+1 809/829/849 …" still resolves to DO rather than US.
    ["DM", "+1(767)###-####"], ["DO", "+1-809-###-####"], ["DO", "+1-829-###-####"], ["DO", "+1-849-###-####"],
    ["DZ", "+213-##-###-####"], ["EC", "+593-##-###-####"], ["EC", "+593-#-###-####"], ["EE", "+372-####-####"],
    ["EE", "+372-###-####"], ["EG", "+20(###)###-####"], ["ER", "+291-#-###-###"], ["ES", "+34(###)###-###"],
    ["ET", "+251-##-###-####"], ["FI", "+358-##-###-####"], ["FI", "+358(###)###-##-##"], ["FJ", "+679-##-#####"], ["FK", "+500-#####"],
    ["FM", "+691-###-####"], ["FO", "+298-###-###"], ["FR", "+33(###)###-###"], ["GA", "+241-#-##-##-##"],
    ["GD", "+1(473)###-####"], ["GE", "+995(###)###-###"], ["GF", "+594-#####-####"], ["GH", "+233(###)###-###"],
    ["GI", "+350-###-#####"], ["GL", "+299-##-##-##"], ["GM", "+220(###)##-##"], ["GN", "+224-##-###-###"], ["GN", "+224-###-##-##-##"],
    ["GP", "+590(###)###-###"], ["GQ", "+240-##-###-####"],
    ["GR", "+30(###)###-####"], ["GT", "+502-#-###-####"], ["GU", "+1(671)###-####"], ["GW", "+245-#-######"],
    ["GY", "+592-###-####"], ["HK", "+852-####-####"], ["HN", "+504-####-####"], ["HR", "+385-#-###-####"], ["HR", "+385-##-###-###"],
    ["HT", "+509-##-##-####"], ["HU", "+36-#-###-####"], ["HU", "+36(###)###-###"], ["ID", "+62(8##)###-####"], ["ID", "+62-##-###-##"],
    ["ID", "+62-##-###-###"], ["ID", "+62-##-###-####"], ["ID", "+62(8##)###-###"], ["ID", "+62(8##)###-##-###"], ["ID", "+62(8##)####-#####"],
    ["IE", "+353-#-###-###"], ["IE", "+353-##-###-###"], ["IE", "+353(###)###-###"], ["IL", "+972-5#-###-####"], ["IL", "+972-#-###-####"], ["IN", "+91(####)###-###"],
    ["IO", "+246-###-####"], ["IQ", "+964(###)###-####"], ["IR", "+98(###)###-####"], ["IS", "+354-###-####"],
    ["IT", "+39-######"], ["IT", "+39(###)###-###"], ["IT", "+39(###)####-###"], ["IT", "+39(###)####-####"], ["JM", "+1(876)###-####"], ["JO", "+962-#-####-####"], ["JP", "+81-#-####-####"], ["JP", "+81-##-####-####"],
    ["JP", "+81(###)###-###"], ["KE", "+254-###-######"], ["KG", "+996(###)###-###"], ["KH", "+855-##-###-###"],
    ["KI", "+686-##-###"], ["KM", "+269-##-#####"], ["KN", "+1(869)###-####"], ["KP", "+850-191-###-####"],
    ["KP", "+850-##-###-###"], ["KP", "+850-###-####-###"], ["KP", "+850-###-###"], ["KP", "+850-####-####"],
    ["KR", "+82-##-###-####"], ["KR", "+82-##-####-####"], ["KW", "+965-####-####"], ["KY", "+1(345)###-####"],
    ["KZ", "+7(6##)###-##-##"], ["KZ", "+7(7##)###-##-##"], ["LA", "+856(20##)###-###"], ["LA", "+856-##-###-###"],
    ["LB", "+961-##-###-###"], ["LB", "+961-#-###-###"], ["LC", "+1(758)###-####"], ["LI", "+423(###)###-####"],
    ["LK", "+94-##-###-####"], ["LR", "+231-##-###-###"], ["LS", "+266-#-###-####"], ["LT", "+370(###)##-###"],
    ["LU", "+352-##-##-##"], ["LU", "+352-##-##-##-##"], ["LU", "+352(###)###-###"], ["LV", "+371-##-###-###"], ["LY", "+218-##-###-###"], ["LY", "+218-21-###-####"],
    ["MA", "+212-##-####-###"], ["MC", "+377(###)###-###"], ["MC", "+377-##-###-###"], ["MD", "+373-####-####"],
    ["ME", "+382-##-###-###"], ["MG", "+261-##-##-#####"], ["MH", "+692-###-####"], ["MK", "+389-##-###-###"],
    ["ML", "+223-##-##-####"], ["MM", "+95-##-###-###"], ["MM", "+95-#-###-###"], ["MM", "+95-###-###"],
    ["MN", "+976-##-##-####"], ["MO", "+853-####-####"], ["MP", "+1(670)###-####"], ["MQ", "+596(###)##-##-##"],
    ["MR", "+222-##-##-####"], ["MS", "+1(664)###-####"], ["MT", "+356-####-####"], ["MU", "+230-###-####"], ["MU", "+230-####-####"],
    ["MV", "+960-###-####"], ["MW", "+265-1-###-###"], ["MW", "+265-#-####-####"], ["MX", "+52(###)###-####"],
    ["MX", "+52-##-##-####"], ["MY", "+60-##-###-####"], ["MY", "+60-##-####-####"], ["MY", "+60(###)###-###"], ["MY", "+60-##-###-###"],
    ["MY", "+60-#-###-###"], ["MZ", "+258-##-###-###"], ["NA", "+264-##-###-####"], ["NC", "+687-##-####"],
    ["NE", "+227-##-##-####"], ["NF", "+672-3##-###"], ["NG", "+234(###)###-####"], ["NG", "+234-##-###-###"],
    ["NG", "+234-##-###-##"], ["NI", "+505-####-####"], ["NL", "+31-##-###-####"], ["NO", "+47(###)##-###"],
    ["NP", "+977-##-###-###"], ["NP", "+977-###-###-####"], ["NR", "+674-###-####"], ["NU", "+683-####"], ["NZ", "+64(###)###-###"],
    ["NZ", "+64-##-###-###"], ["NZ", "+64(###)###-####"], ["OM", "+968-##-###-###"], ["PA", "+507-###-####"],
    ["PE", "+51(###)###-###"], ["PF", "+689-##-##-##"], ["PG", "+675(###)##-###"], ["PH", "+63(###)###-####"],
    ["PK", "+92(###)###-####"], ["PL", "+48(###)###-###"], ["PM", "+508-##-####"], ["PS", "+970-##-###-####"], ["PT", "+351-##-###-####"],
    ["PW", "+680-###-####"], ["PY", "+595(###)###-###"], ["QA", "+974-####-####"], ["RE", "+262-#####-####"],
    ["RO", "+40-##-###-####"], ["RS", "+381-##-###-####"], ["RU", "+7(###)###-##-##"], ["RW", "+250(###)###-###"],
    ["SA", "+966-5-####-####"], ["SA", "+966-#-###-####"], ["SB", "+677-###-####"], ["SB", "+677-#####"],
    ["SC", "+248-#-###-###"], ["SD", "+249-##-###-####"], ["SE", "+46-#-###-###"], ["SE", "+46-##-###-###"], ["SE", "+46-##-###-####"], ["SG", "+65-####-####"],
    ["SH", "+290-####"], ["SI", "+386-##-###-###"], ["SK", "+421(###)###-###"], ["SL", "+232-##-######"],
    ["SM", "+378-####-######"], ["SN", "+221-##-###-####"], ["SO", "+252-##-###-###"], ["SO", "+252-#-###-###"],
    ["SR", "+597-###-####"], ["SR", "+597-###-###"], ["SS", "+211-##-###-####"], ["ST", "+239-##-#####"],
    ["SV", "+503-##-##-####"], ["SX", "+1(721)###-####"], ["SY", "+963-##-####-###"], ["SZ", "+268-##-##-####"],
    ["TC", "+1(649)###-####"], ["TD", "+235-##-##-##-##"], ["TG", "+228-##-###-###"], ["TH", "+66-##-###-####"],
    ["TH", "+66-##-###-###"], ["TJ", "+992-##-###-####"], ["TK", "+690-####"], ["TL", "+670-###-####"],
    ["TL", "+670-77#-#####"], ["TL", "+670-78#-#####"], ["TM", "+993-#-###-####"], ["TN", "+216-##-###-###"],
    ["TO", "+676-#####"], ["TR", "+90(###)###-####"], ["TT", "+1(868)###-####"], ["TV", "+688-90####"],
    ["TV", "+688-2####"], ["TW", "+886-#-####-####"], ["TW", "+886-####-####"], ["TZ", "+255-##-###-####"],
    ["UA", "+380(##)###-##-##"], ["UG", "+256(###)###-###"], ["UK", "+44-##-####-####"], ["US", "+1(###)###-####"],
    ["UY", "+598-#-###-##-##"], ["UZ", "+998-##-###-####"], ["VA", "+39-6-698-#####"], ["VC", "+1(784)###-####"],
    ["VE", "+58(###)###-####"], ["VG", "+1(284)###-####"], ["VI", "+1(340)###-####"], ["VN", "+84-##-####-###"],
    ["VN", "+84(###)####-###"], ["VU", "+678-##-#####"], ["VU", "+678-#####"], ["WF", "+681-##-####"],
    ["WS", "+685-##-####"], ["YE", "+967-###-###-###"], ["YE", "+967-#-###-###"], ["YE", "+967-##-###-###"],
    ["ZA", "+27-##-###-####"], ["ZM", "+260-##-###-####"], ["ZW", "+263-#-######"], ["ZW", "+263-##-###-####"]
];

// Build a country -> [masks...] lookup once.
const MASKS_BY_COUNTRY = PHONE_MASKS.reduce((acc, [iso, mask]) => {
    if (!acc[iso]) acc[iso] = [];
    acc[iso].push(mask);
    return acc;
}, {});

// ISO2 -> flag component for every country in PHONE_MASKS. Falls back to the
// generic phone icon in the UI when a typed prefix doesn't resolve.
const FLAG_BY_COUNTRY = {
    AC: FlagAC, AD: FlagAD, AE: FlagAE, AF: FlagAF, AG: FlagAG, AI: FlagAI,
    AL: FlagAL, AM: FlagAM, AO: FlagAO, AQ: FlagAQ, AR: FlagAR, AS: FlagAS,
    AT: FlagAT, AU: FlagAU, AW: FlagAW, AZ: FlagAZ, BA: FlagBA, BB: FlagBB,
    BD: FlagBD, BE: FlagBE, BF: FlagBF, BG: FlagBG, BH: FlagBH, BI: FlagBI,
    BJ: FlagBJ, BM: FlagBM, BN: FlagBN, BO: FlagBO, BR: FlagBR, BS: FlagBS,
    BT: FlagBT, BW: FlagBW, BY: FlagBY, BZ: FlagBZ, CA: FlagCA, CD: FlagCD,
    CF: FlagCF, CG: FlagCG, CH: FlagCH, CI: FlagCI, CK: FlagCK, CL: FlagCL,
    CM: FlagCM, CN: FlagCN, CO: FlagCO, CR: FlagCR, CU: FlagCU, CV: FlagCV,
    CW: FlagCW, CY: FlagCY, CZ: FlagCZ, DE: FlagDE, DJ: FlagDJ, DK: FlagDK,
    DM: FlagDM, DO: FlagDO, DZ: FlagDZ, EC: FlagEC, EE: FlagEE, EG: FlagEG,
    ER: FlagER, ES: FlagES, ET: FlagET, FI: FlagFI, FJ: FlagFJ, FK: FlagFK,
    FM: FlagFM, FO: FlagFO, FR: FlagFR, GA: FlagGA, GD: FlagGD, GE: FlagGE,
    GF: FlagGF, GH: FlagGH, GI: FlagGI, GL: FlagGL, GM: FlagGM, GN: FlagGN,
    GQ: FlagGQ, GR: FlagGR, GT: FlagGT, GU: FlagGU, GW: FlagGW, GY: FlagGY,
    HK: FlagHK, HN: FlagHN, HR: FlagHR, HT: FlagHT, HU: FlagHU, ID: FlagID,
    IE: FlagIE, IL: FlagIL, IN: FlagIN, IO: FlagIO, IQ: FlagIQ, IR: FlagIR,
    IS: FlagIS, IT: FlagIT, JM: FlagJM, JO: FlagJO, JP: FlagJP, KE: FlagKE,
    KG: FlagKG, KH: FlagKH, KI: FlagKI, KM: FlagKM, KN: FlagKN, KP: FlagKP,
    KR: FlagKR, KW: FlagKW, KY: FlagKY, KZ: FlagKZ, LA: FlagLA, LB: FlagLB,
    LC: FlagLC, LI: FlagLI, LK: FlagLK, LR: FlagLR, LS: FlagLS, LT: FlagLT,
    LU: FlagLU, LV: FlagLV, LY: FlagLY, MA: FlagMA, MC: FlagMC, MD: FlagMD,
    ME: FlagME, MG: FlagMG, MH: FlagMH, MK: FlagMK, ML: FlagML, MM: FlagMM,
    MN: FlagMN, MO: FlagMO, MP: FlagMP, MQ: FlagMQ, MR: FlagMR, MS: FlagMS,
    MT: FlagMT, MU: FlagMU, MV: FlagMV, MW: FlagMW, MX: FlagMX, MY: FlagMY,
    MZ: FlagMZ, NA: FlagNA, NC: FlagNC, NE: FlagNE, NF: FlagNF, NG: FlagNG,
    NI: FlagNI, NL: FlagNL, NO: FlagNO, NP: FlagNP, NR: FlagNR, NU: FlagNU,
    NZ: FlagNZ, OM: FlagOM, PA: FlagPA, PE: FlagPE, PF: FlagPF, PG: FlagPG,
    PH: FlagPH, PK: FlagPK, PL: FlagPL, PS: FlagPS, PT: FlagPT, PW: FlagPW,
    PY: FlagPY, QA: FlagQA, RE: FlagRE, RO: FlagRO, RS: FlagRS, RU: FlagRU,
    RW: FlagRW, SA: FlagSA, SB: FlagSB, SC: FlagSC, SD: FlagSD, SE: FlagSE,
    SG: FlagSG, SH: FlagSH, SI: FlagSI, SK: FlagSK, SL: FlagSL, SM: FlagSM,
    SN: FlagSN, SO: FlagSO, SR: FlagSR, SS: FlagSS, ST: FlagST, SV: FlagSV,
    SX: FlagSX, SY: FlagSY, SZ: FlagSZ, TC: FlagTC, TD: FlagTD, TG: FlagTG,
    TH: FlagTH, TJ: FlagTJ, TK: FlagTK, TL: FlagTL, TM: FlagTM, TN: FlagTN,
    TO: FlagTO, TR: FlagTR, TT: FlagTT, TV: FlagTV, TW: FlagTW, TZ: FlagTZ,
    UA: FlagUA, UG: FlagUG, UK: FlagUK, US: FlagUS, UY: FlagUY, UZ: FlagUZ,
    VA: FlagVA, VC: FlagVC, VE: FlagVE, VG: FlagVG, VI: FlagVI, VN: FlagVN,
    VU: FlagVU, WF: FlagWF, WS: FlagWS, YE: FlagYE, ZA: FlagZA, ZM: FlagZM,
    ZW: FlagZW,
    // Netherlands Antilles (deprecated ISO; +599 is Curaçao / Caribbean NL today)
    AN: FlagCW,
    // Alias: masks/PREFERRED_COUNTRY say "UK", timezone/locale data says "GB"
    GB: FlagUK,
    // Guadeloupe (+590) and Saint-Pierre-et-Miquelon (+508): French overseas
    // collectivities whose official flag is the tricolour (Noto's 🇬🇵/🇵🇲
    // glyphs are the tricolour too). To use the dedicated glyphs instead,
    // import EmojiU1F1Ec1F1F5 (GP) and EmojiU1F1F51F1F2 (PM) if they exist
    // in ../notoemoji/react.
    GP: FlagFR,
    PM: FlagFR,
};

// If mask[i] opens a "(…)" group made of literal digits only — a NANP area
// code such as "(268)" — return those digits; "" for a slot group "(###)" or
// a mixed one like "(6##)" / "(20##)", whose digits belong to the subscriber.
const literalParenGroup = (mask, i) => {
    if (mask[i] !== "(") return "";
    const close = mask.indexOf(")", i);
    if (close === -1) return "";
    const inner = mask.slice(i + 1, close);
    return /^\d+$/.test(inner) ? inner : "";
};

// Extract the dialing prefix (literal digits only) from a mask.
// Examples:
//   "+41-##-###-####"     -> "41"
//   "+1(###)###-####"     -> "1"     (the ### are slots, not literals)
//   "+1(268)###-####"     -> "1268"  (Antigua: 268 is a literal area code)
//   "+7(6##)###-##-##"    -> "7"     (Kazakhstan: the 6 is typed by the user)
//   "+44-##-####-####"    -> "44"
const dialPrefixFromMask = (mask) => {
    if (!mask || mask[0] !== "+") return "";
    let i = 1;
    let prefix = "";
    while (i < mask.length && /\d/.test(mask[i])) { prefix += mask[i++]; }
    return prefix + literalParenGroup(mask, i);
};

// All literal digits a number must START with to fit this mask: the dial
// code plus any fixed digits ahead of the first "#" slot. Only used to match
// a pasted "+…" number to its country, so "+7 7xx…" resolves to Kazakhstan
// ("+7(7##)…" -> "77") while "+7 9xx…" stays Russia ("+7(###)…" -> "7").
const matchHeadFromMask = (mask) => {
    if (!mask || mask[0] !== "+") return "";
    let head = "";
    for (let i = 1; i < mask.length && mask[i] !== "#"; i++) {
        if (/\d/.test(mask[i])) head += mask[i];
    }
    return head;
};

// ── Country detection (timezone-first, locale-fallback) ─────────────────────
//
// Browser-side country detection is best done from the IANA timezone, because
// the locale tells you what language to display rather than where the user is.
// A user in Switzerland with an `en-US` browser will resolve to US via locale
// but `Europe/Zurich` via timezone — the latter is what we want for phone
// country code purposes.
//
// Order:
//   1. Intl.DateTimeFormat().resolvedOptions().timeZone, mapped via the
//      embedded IANA table below (and a small alias map for legacy names).
//   2. Intl.Locale(navigator.language).region for modern browsers.
//   3. Regex match on navigator.languages for older browsers.
//   4. Fallback: "US".
//
// The TIMEZONE_TO_COUNTRY map covers every entry in zone1970.tab (~340 zones).
// For zones shared by multiple countries, the first-listed country in the IANA
// file (the principal location) is used.

// Built from IANA zone1970.tab — 347 timezones.
const TIMEZONE_TO_COUNTRY = {
    "Europe/Andorra": "AD", "Asia/Dubai": "AE", "Asia/Kabul": "AF",
    "Europe/Tirane": "AL", "Asia/Yerevan": "AM", "Antarctica/Casey": "AQ",
    "Antarctica/Davis": "AQ", "Antarctica/DumontDUrville": "AQ", "Antarctica/Mawson": "AQ",
    "Antarctica/Palmer": "AQ", "Antarctica/Rothera": "AQ", "Antarctica/Syowa": "AQ",
    "Antarctica/Troll": "AQ", "Antarctica/Vostok": "AQ", "America/Argentina/Buenos_Aires": "AR",
    "America/Argentina/Cordoba": "AR", "America/Argentina/Salta": "AR", "America/Argentina/Jujuy": "AR",
    "America/Argentina/Tucuman": "AR", "America/Argentina/Catamarca": "AR", "America/Argentina/La_Rioja": "AR",
    "America/Argentina/San_Juan": "AR", "America/Argentina/Mendoza": "AR", "America/Argentina/San_Luis": "AR",
    "America/Argentina/Rio_Gallegos": "AR", "America/Argentina/Ushuaia": "AR", "Pacific/Pago_Pago": "AS",
    "Europe/Vienna": "AT", "Australia/Lord_Howe": "AU", "Antarctica/Macquarie": "AU",
    "Australia/Hobart": "AU", "Australia/Melbourne": "AU", "Australia/Sydney": "AU",
    "Australia/Broken_Hill": "AU", "Australia/Brisbane": "AU", "Australia/Lindeman": "AU",
    "Australia/Adelaide": "AU", "Australia/Darwin": "AU", "Australia/Perth": "AU",
    "Australia/Eucla": "AU", "Asia/Baku": "AZ", "America/Barbados": "BB",
    "Asia/Dhaka": "BD", "Europe/Brussels": "BE", "Europe/Sofia": "BG",
    "Atlantic/Bermuda": "BM", "Asia/Brunei": "BN", "America/La_Paz": "BO",
    "America/Noronha": "BR", "America/Belem": "BR", "America/Fortaleza": "BR",
    "America/Recife": "BR", "America/Araguaina": "BR", "America/Maceio": "BR",
    "America/Bahia": "BR", "America/Sao_Paulo": "BR", "America/Campo_Grande": "BR",
    "America/Cuiaba": "BR", "America/Santarem": "BR", "America/Porto_Velho": "BR",
    "America/Boa_Vista": "BR", "America/Manaus": "BR", "America/Eirunepe": "BR",
    "America/Rio_Branco": "BR", "America/Nassau": "BS", "Asia/Thimphu": "BT",
    "Europe/Minsk": "BY", "America/Belize": "BZ", "America/St_Johns": "CA",
    "America/Halifax": "CA", "America/Glace_Bay": "CA", "America/Moncton": "CA",
    "America/Goose_Bay": "CA", "America/Blanc-Sablon": "CA", "America/Toronto": "CA",
    "America/Nipigon": "CA", "America/Thunder_Bay": "CA", "America/Iqaluit": "CA",
    "America/Pangnirtung": "CA", "America/Atikokan": "CA", "America/Winnipeg": "CA",
    "America/Rainy_River": "CA", "America/Resolute": "CA", "America/Rankin_Inlet": "CA",
    "America/Regina": "CA", "America/Swift_Current": "CA", "America/Edmonton": "CA",
    "America/Cambridge_Bay": "CA", "America/Yellowknife": "CA", "America/Inuvik": "CA",
    "America/Creston": "CA", "America/Dawson_Creek": "CA", "America/Fort_Nelson": "CA",
    "America/Whitehorse": "CA", "America/Dawson": "CA", "America/Vancouver": "CA",
    "Indian/Cocos": "CC", "Europe/Zurich": "CH", "Europe/Vaduz": "LI", "Africa/Abidjan": "CI",
    "Pacific/Rarotonga": "CK", "America/Santiago": "CL", "America/Punta_Arenas": "CL",
    "Pacific/Easter": "CL", "Asia/Shanghai": "CN", "Asia/Urumqi": "CN",
    "America/Bogota": "CO", "America/Costa_Rica": "CR", "America/Havana": "CU",
    "Atlantic/Cape_Verde": "CV", "America/Curacao": "CW", "Indian/Christmas": "CX",
    "Asia/Nicosia": "CY", "Asia/Famagusta": "CY", "Europe/Prague": "CZ",
    "Europe/Berlin": "DE", "Europe/Copenhagen": "DK", "America/Santo_Domingo": "DO",
    "Africa/Algiers": "DZ", "America/Guayaquil": "EC", "Pacific/Galapagos": "EC",
    "Europe/Tallinn": "EE", "Africa/Cairo": "EG", "Africa/El_Aaiun": "EH",
    "Europe/Madrid": "ES", "Africa/Ceuta": "ES", "Atlantic/Canary": "ES",
    "Europe/Helsinki": "FI", "Pacific/Fiji": "FJ", "Atlantic/Stanley": "FK",
    "Pacific/Chuuk": "FM", "Pacific/Pohnpei": "FM", "Pacific/Kosrae": "FM",
    "Atlantic/Faroe": "FO", "Europe/Paris": "FR", "Europe/London": "UK",
    "Asia/Tbilisi": "GE", "America/Cayenne": "GF", "Africa/Accra": "GH",
    "Europe/Gibraltar": "GI", "America/Nuuk": "GL", "America/Danmarkshavn": "GL",
    "America/Scoresbysund": "GL", "America/Thule": "GL", "Europe/Athens": "GR",
    "Atlantic/South_Georgia": "GS", "America/Guatemala": "GT", "Pacific/Guam": "GU",
    "Africa/Bissau": "GW", "America/Guyana": "GY", "Asia/Hong_Kong": "HK",
    "America/Tegucigalpa": "HN", "America/Port-au-Prince": "HT", "Europe/Budapest": "HU",
    "Asia/Jakarta": "ID", "Asia/Pontianak": "ID", "Asia/Makassar": "ID",
    "Asia/Jayapura": "ID", "Europe/Dublin": "IE", "Asia/Jerusalem": "IL",
    "Asia/Kolkata": "IN", "Indian/Chagos": "IO", "Asia/Baghdad": "IQ",
    "Asia/Tehran": "IR", "Atlantic/Reykjavik": "IS", "Europe/Rome": "IT",
    "America/Jamaica": "JM", "Asia/Amman": "JO", "Asia/Tokyo": "JP",
    "Africa/Nairobi": "KE", "Asia/Bishkek": "KG", "Pacific/Tarawa": "KI",
    "Pacific/Enderbury": "KI", "Pacific/Kiritimati": "KI", "Asia/Pyongyang": "KP",
    "Asia/Seoul": "KR", "Asia/Almaty": "KZ", "Asia/Qyzylorda": "KZ",
    "Asia/Qostanay": "KZ", "Asia/Aqtobe": "KZ", "Asia/Aqtau": "KZ",
    "Asia/Atyrau": "KZ", "Asia/Oral": "KZ", "Asia/Beirut": "LB",
    "Asia/Colombo": "LK", "Africa/Monrovia": "LR", "Europe/Vilnius": "LT",
    "Europe/Luxembourg": "LU", "Europe/Riga": "LV", "Africa/Tripoli": "LY",
    "Africa/Casablanca": "MA", "Europe/Monaco": "MC", "Europe/Chisinau": "MD",
    "Pacific/Majuro": "MH", "Pacific/Kwajalein": "MH", "Asia/Yangon": "MM",
    "Asia/Ulaanbaatar": "MN", "Asia/Hovd": "MN", "Asia/Choibalsan": "MN",
    "Asia/Macau": "MO", "America/Martinique": "MQ", "Europe/Malta": "MT",
    "Indian/Mauritius": "MU", "Indian/Maldives": "MV", "America/Mexico_City": "MX",
    "America/Cancun": "MX", "America/Merida": "MX", "America/Monterrey": "MX",
    "America/Matamoros": "MX", "America/Mazatlan": "MX", "America/Chihuahua": "MX",
    "America/Ojinaga": "MX", "America/Hermosillo": "MX", "America/Tijuana": "MX",
    "America/Bahia_Banderas": "MX", "Asia/Kuala_Lumpur": "MY", "Asia/Kuching": "MY",
    "Africa/Maputo": "MZ", "Africa/Windhoek": "NA", "Pacific/Noumea": "NC",
    "Pacific/Norfolk": "NF", "Africa/Lagos": "NG", "America/Managua": "NI",
    "Europe/Amsterdam": "NL", "Europe/Oslo": "NO", "Asia/Kathmandu": "NP",
    "Pacific/Nauru": "NR", "Pacific/Niue": "NU", "Pacific/Auckland": "NZ",
    "Pacific/Chatham": "NZ", "America/Panama": "PA", "America/Lima": "PE",
    "Pacific/Tahiti": "PF", "Pacific/Marquesas": "PF", "Pacific/Gambier": "PF",
    "Pacific/Port_Moresby": "PG", "Pacific/Bougainville": "PG", "Asia/Manila": "PH",
    "Asia/Karachi": "PK", "Europe/Warsaw": "PL", "America/Miquelon": "PM",
    "Pacific/Pitcairn": "PN", "America/Puerto_Rico": "PR", "Asia/Gaza": "PS",
    "Asia/Hebron": "PS", "Europe/Lisbon": "PT", "Atlantic/Madeira": "PT",
    "Atlantic/Azores": "PT", "Pacific/Palau": "PW", "America/Asuncion": "PY",
    "Asia/Qatar": "QA", "Indian/Reunion": "RE", "Europe/Bucharest": "RO",
    "Europe/Belgrade": "RS", "Europe/Kaliningrad": "RU", "Europe/Moscow": "RU",
    "Europe/Simferopol": "RU", "Europe/Kirov": "RU", "Europe/Volgograd": "RU",
    "Europe/Astrakhan": "RU", "Europe/Saratov": "RU", "Europe/Ulyanovsk": "RU",
    "Europe/Samara": "RU", "Asia/Yekaterinburg": "RU", "Asia/Omsk": "RU",
    "Asia/Novosibirsk": "RU", "Asia/Barnaul": "RU", "Asia/Tomsk": "RU",
    "Asia/Novokuznetsk": "RU", "Asia/Krasnoyarsk": "RU", "Asia/Irkutsk": "RU",
    "Asia/Chita": "RU", "Asia/Yakutsk": "RU", "Asia/Khandyga": "RU",
    "Asia/Vladivostok": "RU", "Asia/Ust-Nera": "RU", "Asia/Magadan": "RU",
    "Asia/Sakhalin": "RU", "Asia/Srednekolymsk": "RU", "Asia/Kamchatka": "RU",
    "Asia/Anadyr": "RU", "Asia/Riyadh": "SA", "Pacific/Guadalcanal": "SB",
    "Indian/Mahe": "SC", "Africa/Khartoum": "SD", "Europe/Stockholm": "SE",
    "Asia/Singapore": "SG", "America/Paramaribo": "SR", "Africa/Juba": "SS",
    "Africa/Sao_Tome": "ST", "America/El_Salvador": "SV", "Asia/Damascus": "SY",
    "America/Grand_Turk": "TC", "Africa/Ndjamena": "TD", "Indian/Kerguelen": "TF",
    "Asia/Bangkok": "TH", "Asia/Dushanbe": "TJ", "Pacific/Fakaofo": "TK",
    "Asia/Dili": "TL", "Asia/Ashgabat": "TM", "Africa/Tunis": "TN",
    "Pacific/Tongatapu": "TO", "Europe/Istanbul": "TR", "America/Port_of_Spain": "TT",
    "Pacific/Funafuti": "TV", "Asia/Taipei": "TW", "Europe/Kiev": "UA",
    "Europe/Uzhgorod": "UA", "Europe/Zaporozhye": "UA", "Pacific/Wake": "UM",
    "America/New_York": "US", "America/Detroit": "US", "America/Kentucky/Louisville": "US",
    "America/Kentucky/Monticello": "US", "America/Indiana/Indianapolis": "US", "America/Indiana/Vincennes": "US",
    "America/Indiana/Winamac": "US", "America/Indiana/Marengo": "US", "America/Indiana/Petersburg": "US",
    "America/Indiana/Vevay": "US", "America/Chicago": "US", "America/Indiana/Tell_City": "US",
    "America/Indiana/Knox": "US", "America/Menominee": "US", "America/North_Dakota/Center": "US",
    "America/North_Dakota/New_Salem": "US", "America/North_Dakota/Beulah": "US", "America/Denver": "US",
    "America/Boise": "US", "America/Phoenix": "US", "America/Los_Angeles": "US",
    "America/Anchorage": "US", "America/Juneau": "US", "America/Sitka": "US",
    "America/Metlakatla": "US", "America/Yakutat": "US", "America/Nome": "US",
    "America/Adak": "US", "Pacific/Honolulu": "US", "America/Montevideo": "UY",
    "Asia/Samarkand": "UZ", "Asia/Tashkent": "UZ", "America/Caracas": "VE",
    "Asia/Ho_Chi_Minh": "VN", "Pacific/Efate": "VU", "Pacific/Wallis": "WF",
    "Pacific/Apia": "WS", "Africa/Johannesburg": "ZA",
};

// Legacy aliases (browsers may still emit these for backward compatibility)
const TIMEZONE_ALIASES = {
    "Asia/Calcutta":         "Asia/Kolkata",
    "Asia/Saigon":           "Asia/Ho_Chi_Minh",
    "Asia/Katmandu":         "Asia/Kathmandu",
    "Asia/Rangoon":          "Asia/Yangon",
    "Asia/Chungking":        "Asia/Shanghai",
    "Asia/Harbin":           "Asia/Shanghai",
    "Asia/Kashgar":          "Asia/Urumqi",
    "Asia/Macao":            "Asia/Macau",
    "Europe/Kyiv":           "Europe/Kiev",
    "Europe/Belfast":        "Europe/London",
    "Europe/Guernsey":       "Europe/London",
    "Europe/Isle_of_Man":    "Europe/London",
    "Europe/Jersey":         "Europe/London",
    "Europe/Nicosia":        "Asia/Nicosia",
    "America/Buenos_Aires":  "America/Argentina/Buenos_Aires",
    "America/Cordoba":       "America/Argentina/Cordoba",
    "America/Catamarca":     "America/Argentina/Catamarca",
    "America/Jujuy":         "America/Argentina/Jujuy",
    "America/Mendoza":       "America/Argentina/Mendoza",
    "America/Indianapolis":  "America/Indiana/Indianapolis",
    "America/Louisville":    "America/Kentucky/Louisville",
    "America/Atka":          "America/Adak",
    "America/Knox_IN":       "America/Indiana/Knox",
    "America/Porto_Acre":    "America/Rio_Branco",
    "Pacific/Truk":          "Pacific/Chuuk",
    "Pacific/Yap":           "Pacific/Chuuk",
    "Pacific/Ponape":        "Pacific/Pohnpei",
    "Pacific/Samoa":         "Pacific/Pago_Pago",
    "Australia/Canberra":    "Australia/Sydney",
    "Australia/NSW":         "Australia/Sydney",
    "Australia/Queensland":  "Australia/Brisbane",
    "Australia/Tasmania":    "Australia/Hobart",
    "Australia/Victoria":    "Australia/Melbourne",
    "Australia/West":        "Australia/Perth",
    "Australia/South":       "Australia/Adelaide",
    "Australia/North":       "Australia/Darwin",
    "Australia/Currie":      "Australia/Hobart",
    "Australia/ACT":         "Australia/Sydney",
};

const detectBrowserCountry = () => {
    // 1. Timezone — strongest geographic signal.
    try {
        let tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) {
            // Resolve legacy aliases (e.g. "Asia/Calcutta" -> "Asia/Kolkata").
            if (TIMEZONE_ALIASES[tz]) tz = TIMEZONE_ALIASES[tz];
            const iso = TIMEZONE_TO_COUNTRY[tz];
            if (iso && MASKS_BY_COUNTRY[iso]) return iso;
        }
    } catch (_) {}

    // 2. Intl.Locale.region (modern browsers).
    try {
        if (typeof Intl !== "undefined" && typeof Intl.Locale === "function") {
            const langs = (navigator.languages && navigator.languages.length)
                ? navigator.languages
                : [navigator.language || ""];
            for (const lng of langs) {
                try {
                    const region = new Intl.Locale(lng).region;
                    if (region && MASKS_BY_COUNTRY[region.toUpperCase()]) {
                        return region.toUpperCase();
                    }
                } catch (_) {}
            }
        }
    } catch (_) {}

    // 3. Regex on navigator.languages (older browsers).
    try {
        const langs = (navigator.languages && navigator.languages.length)
            ? navigator.languages
            : [navigator.language || navigator.userLanguage || ""];
        for (const lng of langs) {
            const match = String(lng).match(/[-_]([A-Z]{2})\b/i);
            if (match) {
                const iso = match[1].toUpperCase();
                if (MASKS_BY_COUNTRY[iso]) return iso;
            }
        }
    } catch (_) {}

    return "US";
};

/**
 * Apply a phone mask to a raw digit string.
 *
 *  - `#` in the mask consumes one digit.
 *  - Literal characters (`+`, `-`, `(`, `)`, space, digits in country code) are
 *    emitted as-is whenever the user has typed at least one digit past them.
 *  - Returns { formatted, digitsConsumed } so callers can know how many digits
 *    the mask absorbed (useful for detecting overflow).
 */
const applyMask = (digits, mask) => {
    // No digits, no output: a subscriber mask that opens with a literal, like
    // "(###)###-####", must not leave a lone "(" in an emptied field (which
    // also kept the placeholder from showing).
    if (!digits || digits.length === 0) return { formatted: "", digitsConsumed: 0 };
    let out = "";
    let di = 0;
    for (let mi = 0; mi < mask.length; mi++) {
        const mc = mask[mi];
        if (mc === "#") {
            if (di >= digits.length) break;
            out += digits[di++];
        } else {
            // Literal: only emit if we still have digits to place OR we've already
            // started consuming (so the user sees the prefix while typing).
            if (di < digits.length || mi === 0) {
                out += mc;
            } else {
                break;
            }
        }
    }
    return { formatted: out, digitsConsumed: di };
};

/**
 * Pick the best mask entry for a country given the current SUBSCRIBER digit
 * count (see `maskEntries`). Prefers the mask whose subscriber slot count is
 * >= digit count and is the smallest such; falls back to the longest mask if
 * all are too short.
 */
const pickMaskEntry = (country, digitCount) => {
    const candidates = maskEntries(country);
    if (candidates.length === 0) return null;
    const fits = candidates.filter(c => c.slots >= digitCount).sort((a, b) => a.slots - b.slots);
    if (fits.length > 0) return fits[0];
    return candidates.slice().sort((a, b) => b.slots - a.slots)[0];
};

// Confirmation code mask: XXX-XXX over the 36-char alphabet [A-Z0-9] — the
// account service sends 6 characters, letters and digits. Input is upper-
// cased automatically so "abc123" types as "ABC-123".
const formatConfirmationCode = (raw) => {
    const cleaned = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (cleaned.length <= 3) return cleaned;
    return cleaned.slice(0, 3) + "-" + cleaned.slice(3);
};

// Full E.164 from the dial-code field ("+41") + subscriber digits — the shape
// the account service's normalizePhone expects.
const composeE164 = (dialCode, subscriberDigits) => {
    const cc = String(dialCode || "").replace(/[^0-9]/g, "");
    const sub = String(subscriberDigits || "").replace(/[^0-9]/g, "");
    return "+" + cc + sub;
};

// ── Subscriber-only mask helpers ─────────────────────────────────────────────
//
// The full mask from PHONE_MASKS includes the country code, e.g. "+41-##-###-####".
// We want to display only the subscriber portion ("##-###-####") inside the
// phone input — the country code lives as a separate label/prefix outside.
//
// `stripPrefixFromMask` returns the part of the mask that represents the
// subscriber number (after the country code).
//
// Three cases:
//  - Slots in parens, like "+1(###)###-####": parens enclose ### slots, so the
//    subscriber INCLUDES the "(" — result "(###)###-####". The country code is
//    just "+1".
//  - Literals in parens, like "+1(268)###-####": parens enclose literal area-
//    code digits that identify the specific country/region (Antigua, etc.).
//    Strip the entire "+1(268)" — subscriber is "###-####".
//  - Literal digits left INSIDE the subscriber part — "+971-5#-###-####" (UAE
//    mobiles), "+55(##)9####-####" (Brazilian mobiles), "+7(6##)###-##-##"
//    (Kazakhstan) — become "#" slots. The user types them, so they land in
//    `_phoneRaw` and in the E.164 number. As display-only literals they were
//    shown in the field but silently missing from the number we sent the SMS
//    to (and the real digit was cut off by the slot cap).
const stripPrefixFromMask = (mask) => {
    if (!mask) return "";
    if (mask[0] !== "+") return mask;
    let i = 1;
    while (i < mask.length && /\d/.test(mask[i])) i++;
    const group = literalParenGroup(mask, i);
    if (group) i += group.length + 2; // "(" + digits + ")"
    // Skip ONE optional separator character if it's "-" or " ".
    if (mask[i] === "-" || mask[i] === " ") i++;
    return mask.slice(i).replace(/\d/g, "#");
};

// Per-country mask entries, derived once from PHONE_MASKS:
//   { mask, dial, sub, slots } — the full mask, its dial code (digits, no +),
//   the subscriber-only mask and that mask's slot count.
let _MASK_ENTRIES = null;
const maskEntries = (country) => {
    if (!_MASK_ENTRIES) {
        _MASK_ENTRIES = {};
        for (const [iso, mask] of PHONE_MASKS) {
            const sub = stripPrefixFromMask(mask);
            if (!_MASK_ENTRIES[iso]) _MASK_ENTRIES[iso] = [];
            _MASK_ENTRIES[iso].push({ mask, dial: dialPrefixFromMask(mask), sub, slots: (sub.match(/#/g) || []).length });
        }
    }
    return _MASK_ENTRIES[country] || [];
};

// Shortest / longest subscriber length among a country's masks ({0, 0} for an
// unknown country). A number whose length falls in this range is "complete"
// as far as the masks know — numbering plans with several lengths (DE, IT,
// AT…) have a mask per length, so the range, not one exact count, decides.
const slotRange = (country) => {
    const entries = maskEntries(country);
    if (entries.length === 0) return { min: 0, max: 0 };
    let min = Infinity, max = 0;
    for (const e of entries) { if (e.slots < min) min = e.slots; if (e.slots > max) max = e.slots; }
    return { min, max };
};

// Sanity limit on subscriber digits: E.164 allows 15 digits in total, so no
// national number is longer than this. Nothing else truncates what the user
// enters — an over-long number is shown as is and flagged under the field.
const PHONE_MAX_DIGITS = 15;

// The leading "0" of a nationally-dialled number is a trunk prefix that is
// dropped in international format ("079 …" -> "+41 79 …") — except in the few
// plans where it is part of the number itself: Italy (landlines "+39 02 …"),
// Côte d'Ivoire ("+225 07 …" since the 2021 renumbering) and Benin ("+229 01 …"
// since November 2024).
const KEEP_TRUNK_ZERO = new Set(["IT", "VA", "CI", "BJ"]);
const stripTrunkZero = (digits, country) =>
    KEEP_TRUNK_ZERO.has(country) ? String(digits || "") : String(digits || "").replace(/^0+/, "");

// Best subscriber-only mask for a country given current subscriber digit count.
const pickSubscriberMask = (country, digitCount) => {
    const entry = pickMaskEntry(country, digitCount);
    return entry ? entry.sub : "";
};

// Format subscriber-only digits under the country's mask. Digits beyond the
// longest mask are not cut: the number is then shown unformatted, so the user
// sees exactly what they entered (StepVerify flags it as over-long).
const formatSubscriber = (digits, country) => {
    const str = String(digits || "");
    const entry = pickMaskEntry(country, str.length);
    if (!entry || str.length > entry.slots) return str;
    return applyMask(str, entry.sub).formatted;
};

// Country code (digits, no +) for a given ISO2. Every mask of a country
// carries the same dial code (see the PHONE_MASKS invariant), so the choice
// of entry does not matter.
const dialCodeFor = (country) => {
    const entry = pickMaskEntry(country, 0);
    return entry ? entry.dial : "";
};

// Walk known number heads (longest first) and return the country whose mask
// matches the leading digits, plus that country's dial code. Used when the
// user pastes/types a "+..." number and we want to auto-switch country.
//
// PREFERRED_COUNTRY overrides resolve ambiguity for shared heads (e.g. head
// "1" maps to many NANP countries; we prefer US over Canada/AG/AI).
const PREFERRED_COUNTRY = {
    "1":  "US",
    "44": "UK",
    "33": "FR",
    "39": "IT",  // VA also uses +39 but Italy is far more common
    "47": "NO",
    "61": "AU",
    "64": "NZ",
};

let _SORTED_HEADS = null;
const sortedHeads = () => {
    if (_SORTED_HEADS) return _SORTED_HEADS;
    const seen = new Map(); // head -> { iso, dial }
    for (const [iso, mask] of PHONE_MASKS) {
        const head = matchHeadFromMask(mask);
        if (!head) continue;
        const dial = dialPrefixFromMask(mask);
        if (PREFERRED_COUNTRY[head]) {
            seen.set(head, { iso: PREFERRED_COUNTRY[head], dial });
        } else if (!seen.has(head)) {
            seen.set(head, { iso, dial });
        }
    }
    _SORTED_HEADS = Array.from(seen.entries()).sort((a, b) => b[0].length - a[0].length);
    return _SORTED_HEADS;
};

// `digits` is the full international number without "+". Returns
// { country, prefix } where `prefix` is the dial code to strip off the front
// of `digits` to get the subscriber part.
const matchCountryByPrefix = (digits) => {
    for (const [head, { iso, dial }] of sortedHeads()) {
        if (digits.startsWith(head)) return { country: iso, prefix: dial };
    }
    return null;
};

// Normalise whatever lands in the phone field — typed, pasted or autofilled —
// into { intl, digits }. `intl` is true when a "+" (or the "00" international
// access code) precedes the first digit; `digits` then starts with the
// country code. Real-world clipboard text hides the "+" in several ways:
//   - iOS/macOS Contacts, WhatsApp and many web pages wrap numbers in
//     invisible bidi marks (U+202A…U+202C, U+200E), which String.trim() does
//     not remove, so "+33 6…" used to be read as "33 6…";
//   - "(+33) 6 12…", "Tél. : +33 6…" and "tel:+33…" put text before the "+";
//   - some keyboards emit a full-width "＋" / full-width digits;
//   - the international form is often written "0033 6 12…".
const parsePhoneInput = (raw) => {
    const s = String(raw || "")
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g, "")
        .replace(/[\uFF10-\uFF19]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFF10 + 0x30))
        .replace(/\uFF0B/g, "+");
    const plus = s.indexOf("+");
    const firstDigit = s.search(/\d/);
    const digits = s.replace(/\D/g, "");
    if (plus !== -1 && (firstDigit === -1 || plus < firstDigit)) return { intl: true, digits };
    // "00…": no national number starts with two zeros (the trunk prefix is a
    // single 0), so this is unambiguously the international access code.
    if (/^00\d/.test(digits)) return { intl: true, digits: digits.slice(2) };
    return { intl: false, digits };
};

// Localised country name from an Intl.DisplayNames instance (ISO2 fallback).
// "UK" is the masks' name for GB; "AC" (Ascension) is displayed as St Helena.
const regionNameOf = (regionNames, iso) => {
    if (!regionNames) return iso;
    try { return regionNames.of(iso === "UK" ? "GB" : iso === "AC" ? "SH" : iso) || iso; } catch (_) { return iso; }
};

// One entry per ISO2 for the country picker, with its dialing code. Names are
// localized at render time via Intl.DisplayNames (ISO2 fallback).
let _COUNTRY_ENTRIES = null;
const countryEntries = () => {
    if (_COUNTRY_ENTRIES) return _COUNTRY_ENTRIES;
    const seen = new Set();
    const out = [];
    for (const [iso] of PHONE_MASKS) {
        if (seen.has(iso)) continue;
        seen.add(iso);
        const code = dialCodeFor(iso);
        if (code) out.push({ iso, code });
    }
    _COUNTRY_ENTRIES = out;
    return _COUNTRY_ENTRIES;
};

// =============================================================================

const styles = theme => ({
    // Keyframes at the sheet's top level, where the "$name" references below
    // resolve (the form Home.js documents).
    "@keyframes shake": {
        "0%": { transform: "translateX(0)" },
        "18%": { transform: "translateX(-7px)" },
        "36%": { transform: "translateX(6px)" },
        "54%": { transform: "translateX(-4px)" },
        "72%": { transform: "translateX(3px)" },
        "100%": { transform: "translateX(0)" },
    },
    "@keyframes codeCaretBlink": {
        "0%": { opacity: 1 },
        "50%": { opacity: 0 },
        "100%": { opacity: 1 },
    },
    backdrop: {
        zIndex: "1301",
        color: '#fff',
    },
    whiteButton: {
        "&.MuiButton-contained": {
            backgroundColor: "#ffffff",
            color: "#000000",
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        "&.MuiButton-contained:hover": {
            backgroundColor: "#e8e8e8",
            color: "#000000",
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        }
    },
    dialog: {
        "& .MuiDialog-paperFullWidth": {
            width: "min(100%, 1080px) !important",
            position: "relative",
            display: "flex",
            flexDirection: "row",
            maxHeight: "90vh",
            background: "linear-gradient(50deg, #171717 15%, #000000 70%)",
            [theme.breakpoints.down("md")]: {
                background: "linear-gradient(50deg, #000000 15%, #000000 70%)",
            }
        },
        // Fullscreen (mobile): size the paper to the *visual* viewport so the
        // bottom action bar is never hidden behind the on-screen keyboard.
        // Mobile browsers shrink only the visual viewport when the keyboard
        // opens — the layout viewport (what 100%/100vh measure) keeps its full
        // height, which is why the buttons were sliding under the keyboard.
        // --cad-vvh / --cad-vvt are kept in sync by _updateVisualViewport().
        "& .MuiDialog-paperFullScreen": {
            height: "var(--cad-vvh, 100%)",
            maxHeight: "var(--cad-vvh, 100%)",
            minHeight: 0,
            margin: 0,
            // Pin the paper to the TOP of the dialog container. The
            // scrollPaper container is a flexbox with align-items:center,
            // so as soon as the paper is shorter than 100% (keyboard open,
            // height = --cad-vvh) it floats vertically centered — gap above,
            // action bar pushed below the keyboard. flex-start keeps its top
            // edge at the layout-viewport top, which translateY(--cad-vvt)
            // then maps onto the *visual* viewport top.
            alignSelf: "flex-start",
            // Follow the visual viewport when iOS Safari scrolls the page on
            // input focus (fixed elements stay glued to the layout viewport).
            transform: "translateY(var(--cad-vvt, 0px))",
        }
    },
    dialogActions: {
        textAlign: "right",
        flexShrink: 0,
        backgroundColor: "inherit",
        padding: "16px 24px",
        [theme.breakpoints.down("md")]: {
            padding: "12px 16px",
            // Keep the buttons clear of the iOS home indicator in fullscreen.
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }
    },
    smallDesktopHidden: {
        flexShrink: 0,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "24px",
        [theme.breakpoints.down("md")]: {
            display: "none",
        }
    },
    flexDesktop: {
        display: "flex",
        flex: 1,
        minHeight: 0,
        [theme.breakpoints.down("md")]: {
            flexDirection: "column",
            height: "100%",
        }
    },
    floatRightDesktop: {
        display: "grid",
        // Pin the stepper to the top row and the action bar to the bottom row;
        // the middle (scrollable content) row absorbs all remaining space. When
        // the keyboard shrinks the dialog, only the content area shrinks and
        // scrolls — CANCEL/NEXT stay visible at the bottom edge.
        gridTemplateRows: "auto minmax(0, 1fr) auto",
        // One column, never wider than the dialog: an implicit (auto) column
        // grows to its widest row's min-content, and a step name that can't
        // wrap then stretched the content and the action bar off-screen too.
        gridTemplateColumns: "minmax(0, 1fr)",
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        [theme.breakpoints.down("md")]: {
            flex: 1,
            height: "100%",
        }
    },
    stepperContainer: {
        flexShrink: 0,
        backgroundColor: "transparent",
        [theme.breakpoints.down("md")]: {
            backgroundColor: "transparent",
        }
    },
    // Phones (see COMPACT_STEPPER_MAX_WIDTH): names under the circles, a
    // little smaller, wrapping between words — and inside one only when a
    // single word is wider than its third.
    stepperCompact: {
        "& .MuiStepLabel-label.MuiStepLabel-alternativeLabel": {
            marginTop: 6,
            fontSize: 12,
            lineHeight: 1.25,
            overflowWrap: "anywhere",
            hyphens: "auto",
        },
        "& .MuiStep-alternativeLabel": {
            paddingLeft: 2,
            paddingRight: 2,
            minWidth: 0,
        },
    },
    swipeableContainer: {
        flex: 1,
        minHeight: 0,
        overflow: "overlay",
        borderRadius: "21px",
        "& .react-swipeable-view-container": {
            height: "100%",
        },
        "& .react-swipeable-view-container > div": {
            overflowY: "auto !important",
            overflowX: "hidden !important",
        },
        [theme.breakpoints.down("md")]: {
            backgroundColor: "#000"
        }
    },
    buttonNotDisabled: {
        "&.MuiButtonBase-root.Mui-disabled": {
            cursor: "help",
            pointerEvents: "all"
        }
    },
    usernameInput: {

    },
    passwordInput: {

    },
    progressCircle: {

    },
    inputEndAdornment: {
        "& .MuiIconButton-root.Mui-disabled": {
            color: "#7b7b7b",
        },
        "& .MuiCircularProgress-colorSecondary": {
            color: "#7b7b7b",
            marginLeft: "8px"
        }
    },
    boxGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "16px",
        listStyle: "inside decimal-leading-zero",
        padding: "0px",
        margin: "16px 0px 16px 0px",
        '@media (max-width:550px)': {
            gridTemplateColumns: 'repeat(2, 1fr)',
        },
        '@media (max-width:350px)': {
            gridTemplateColumns: 'repeat(1, 1fr)',
        },
        "& > li": {
            cursor: "pointer",
            userSelect: "none",
            backgroundColor: "#171717",
            color: "#ddd",
            borderRadius: "48px",
            padding: "12px 16px",
            transition: "background-color 200ms cubic-bezier(0.4, 0, 0.2, 1) 5ms, color 200ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        },
        "& > li:hover": {
            backgroundColor: "#212121",
            color: "#fff",
            transition: "background-color 350ms cubic-bezier(0.4, 0, 0.2, 1) 5ms, color 350ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        },
        "& > li::marker": {
            color: "#aaa",
        }
    },
    boxPassword: {
        "&": {
            display: "block",
            width: "100%",
            margin: "16px 0px 16px 0px",
            cursor: "pointer",
            userSelect: "none",
            backgroundColor: "#171717",
            color: "#ddd",
            borderRadius: "48px",
            padding: "12px 16px",
            transition: "background-color 200ms cubic-bezier(0.4, 0, 0.2, 1) 5ms, color 200ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        },
        "&:hover": {
            backgroundColor: "#212121",
            color: "#fff",
            transition: "background-color 350ms cubic-bezier(0.4, 0, 0.2, 1) 5ms, color 350ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        },
    },
    advancedToggle: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        cursor: "pointer",
        userSelect: "none",
        padding: "8px 4px",
        margin: "8px 0 4px 0",
        color: "#bdbdbd",
        transition: "color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
            color: "#fff",
        },
        "& .advancedToggleLabel": {
            fontSize: 14,
        },
        "& .advancedToggleIcon": {
            transition: "transform 250ms cubic-bezier(0.4, 0, 0.2, 1)",
        },
        "& .advancedToggleIcon.open": {
            transform: "rotate(180deg)",
        },
    },
    termsRow: {
        marginTop: 4,
        marginBottom: 0,
        userSelect: "none",
        "& .MuiTypography-root": {
            fontSize: 14,
            color: "#bdbdbd",
            transition: "color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
        },
        "&:hover .MuiTypography-root": {
            color: "#fff",
        },
        "& .MuiCheckbox-root": {
            color: "#7b7b7b",
        },
        "& .MuiCheckbox-root.Mui-checked": {
            color: "#ffffff",
        },
    },
    // "Terms of Use" / "Privacy Policy" inside the agreement sentence: text,
    // underlined, that opens its document — and only that (no tick).
    termsLink: {
        font: "inherit",
        verticalAlign: "baseline",
        textUnderlineOffset: "2px",
        cursor: "pointer",
        "&:hover": {
            color: "#ffffff",
        },
    },
    termsDialog: {
        "& .MuiDialog-paper": {
            background: "#171717",
            borderRadius: "21px",
            // Fixed height: switching between the Terms of Use and the (much
            // shorter) Privacy Policy must not resize the modal. The
            // DialogContent below is the scroll container.
            height: "min(calc(100% - 64px), 900px)",
        },
        "& .MuiDialog-paperFullScreen": {
            borderRadius: 0,
            height: "100%",
        },
    },
    // Same pill tabs as AppInfoDialog.cardTabs, so the two places the
    // documents are shown look alike.
    termsTabs: {
        backgroundColor: "#171717",
        "& .MuiTab-root": {
            minWidth: "72px !important"
        },
        "& .MuiTab-textColorPrimary.Mui-selected": {
            backgroundColor: "transparent",
        },
        "& .MuiTab-textColorPrimary.Mui-selected .MuiTab-wrapper": {
            color: "#171717 !important"
        },
        "& .MuiTab-fullWidth": {
            backgroundColor: "transparent",
            color: "#989898",
            transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            borderRadius: "21px"
        },
        "& .MuiTab-fullWidth:hover": {
            backgroundColor: "rgba(255,255,255,0.06)"
        },
        "& span.MuiTabs-indicator": {
            zIndex: "-1",
            height: "48px",
            backgroundColor: "#c7c7c7",
            borderRadius: "21px",
            transform: "scale3d(0.875, 0.75, 1)"
        },
        margin: "0px 16px 8px 16px",
        width: "calc(100% - 32px)",
        borderRadius: "21px",
        flexShrink: 0,
        zIndex: 1,
    },
    termsContent: {
        // Explicit scroll container (MUI's scroll="paper" default) — the
        // tab-change handler resets its scrollTop.
        overflowY: "auto",
        "& > div": {
            // The documents' own <div> wrapper; keep the last paragraph clear
            // of the action bar when scrolled to the bottom.
            paddingBottom: 8,
        },
    },
    capacityCard: {
        marginTop: 16,
        padding: "14px 18px",
        borderRadius: 16,
        background: "rgba(255, 255, 255, 0.05)",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        userSelect: "none",
        "& .capCol": {
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
        },
        "& .capRight": {
            alignItems: "flex-end",
            textAlign: "right",
        },
        "& .capValue": {
            fontSize: 34,
            fontWeight: 500,
            color: "#ffffff",
            lineHeight: 1.15,
            // Fixed-width digits so the ticking countdown doesn't jitter.
            fontVariantNumeric: "tabular-nums",
        },
        "& .capLabel": {
            fontSize: 12,
            color: "#7b7b7b",
            marginTop: 2,
        },
    },
    countryPickerDialog: {
        "& .MuiDialog-paper": {
            background: "#171717",
            borderRadius: "21px",
            width: "100%",
            maxWidth: 400,
        },
    },
    countryPickerList: {
        maxHeight: 320,
        overflowY: "auto",
        marginTop: 8,
        // Slim greyscale scrollbar
        "&::-webkit-scrollbar": { width: 6 },
        "&::-webkit-scrollbar-thumb": { background: "#3a3a3a", borderRadius: 3 },
    },
    countryPickerRow: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 12,
        cursor: "pointer",
        userSelect: "none",
        color: "#ffffff",
        "&:hover": { background: "rgba(255, 255, 255, 0.06)" },
        "& .pickerPrefix": { marginLeft: "auto", color: "#7b7b7b", fontSize: 14 },
        "& .pickerName": { fontSize: 15 },
    },
    dialCodeButton: {
        cursor: "pointer",
        background: "transparent",
        border: "none",
        outline: "none",
        color: "#fff",
        fontSize: "inherit",
        fontFamily: "inherit",
        padding: 0,
        textAlign: "left",
    },
    dialFlag: {
        width: 22,
        height: 22,
        marginRight: 8,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        userSelect: "none",
        "& svg": {
            width: "100%",
            height: "100%",
        },
    },
    statusPanel: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "32px 16px",
        minHeight: 180,
    },
    statusIconSuccess: {
        fontSize: 64,
        color: "#ffffff",
    },
    // One short horizontal shake: a failed code, a close refused until the
    // backup is saved. Restarts whenever the class is put back on.
    shake: {
        animationName: "$shake",
        animationDuration: "380ms",
        animationTimingFunction: "cubic-bezier(0.36, 0.07, 0.19, 0.97)",
        "@media (prefers-reduced-motion: reduce)": {
            animationName: "none",
        },
    },
    // ── Confirmation code: six boxes over one input (see CodeBoxes) ──
    codeLabel: {
        display: "block",
        fontSize: 13,
        color: "#bdbdbd",
        margin: "8px 0 10px 2px",
        textAlign: "left",
        userSelect: "none",
    },
    codeRow: {
        display: "flex",
        alignItems: "center",
        gap: 12,
    },
    codeBoxes: {
        position: "relative",
        flex: "1 1 auto",
        minWidth: 0,
        maxWidth: 452,
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "text",
        userSelect: "none",
        [theme.breakpoints.down("xs")]: {
            gap: 5,
        },
    },
    codeBox: {
        flex: "1 1 0",
        minWidth: 0,
        maxWidth: 64,
        height: 64,
        borderRadius: 14,
        border: "2px solid rgba(255, 255, 255, 0.23)",
        background: "rgba(255, 255, 255, 0.04)",
        color: "#ffffff",
        fontSize: 28,
        fontWeight: 500,
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontVariantNumeric: "tabular-nums",
        transition: "border-color 160ms cubic-bezier(0.4, 0, 0.2, 1), background-color 160ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 160ms cubic-bezier(0.4, 0, 0.2, 1)",
        [theme.breakpoints.down("xs")]: {
            height: 56,
            fontSize: 24,
            borderRadius: 12,
        },
    },
    codeBoxFilled: {
        borderColor: "rgba(255, 255, 255, 0.5)",
    },
    codeBoxActive: {
        borderColor: "#ffffff",
        background: "rgba(255, 255, 255, 0.08)",
        boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.12)",
    },
    codeBoxOk: {
        borderColor: "#ffffff",
    },
    codeBoxFail: {
        borderColor: "#7b7b7b",
        color: "#bdbdbd",
    },
    // The code reads ABC-123: a short dash between the two groups of three.
    codeSeparator: {
        flex: "0 0 auto",
        width: 10,
        height: 2,
        borderRadius: 1,
        background: "#5a5a5a",
        [theme.breakpoints.down("xs")]: {
            width: 6,
        },
    },
    codeCaret: {
        width: 2,
        height: "45%",
        borderRadius: 1,
        background: "#ffffff",
        animationName: "$codeCaretBlink",
        animationDuration: "1.1s",
        animationTimingFunction: "steps(1)",
        animationIterationCount: "infinite",
    },
    // The one real input, laid over the boxes and fully transparent: it takes
    // every tap, keystroke, paste and SMS autofill; the boxes only draw.
    codeInput: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        margin: 0,
        padding: 0,
        border: 0,
        outline: "none",
        background: "transparent",
        color: "transparent",
        caretColor: "transparent",
        WebkitTextFillColor: "transparent",
        // At least 16px: iOS zooms the page into a smaller focused input.
        fontSize: 16,
        cursor: "text",
        appearance: "none",
        "&::selection": {
            background: "transparent",
        },
        // Autofill must not paint its tint over the boxes.
        "&:-webkit-autofill": {
            transition: "background-color 600000s 0s, color 600000s 0s",
        },
    },
    codeStatus: {
        flex: "0 0 auto",
        width: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#7b7b7b",
    },
    // ── Quit confirmation: a fully white modal over the dark dialog ──
    quitDialog: {
        "& .MuiDialog-paper": {
            background: "#ffffff",
            color: "#000000",
            borderRadius: 21,
            padding: "8px 8px 4px",
        },
        "& .MuiDialogTitle-root .MuiTypography-root": {
            color: "#000000",
            fontWeight: 600,
        },
        "& .MuiDialogContent-root .MuiTypography-root": {
            color: "#4a4a4a",
            fontSize: 15,
            textAlign: "left",
        },
        "& .MuiDialogActions-root": {
            padding: "8px 16px 16px",
        },
        "& .quitLeave": {
            color: "#3d3d3d",
            "&:hover": {
                backgroundColor: "rgba(0, 0, 0, 0.06)",
            },
        },
        "& .quitStay": {
            backgroundColor: "#000000",
            color: "#ffffff",
            boxShadow: "none",
            "&:hover": {
                backgroundColor: "#262626",
                boxShadow: "none",
            },
        },
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// The step-0 agreement sentence, with the two document names in it as links
//   Ticking the box (or clicking the plain words of the sentence) only ticks
//   it; the underlined "Terms of Use" and "Privacy Policy" only open their
//   document — a click on a link never ticks the box.
//
//   The names are found in the sentence as each locale words it (the same
//   keys that title the documents' modal — plus the usual English wordings of
//   the terms), so the sentence keeps its translation. A name a locale words
//   differently inside its sentence is added after it instead, so both
//   documents can always be opened.
// ─────────────────────────────────────────────────────────────────────────────
const TERMS_AGREEMENT_KEY = "components.create_account_dialog.i_have_read_the_terms_of_use_and";
const TERMS_ENGLISH_WORDINGS = ["Terms and Conditions", "Terms & Conditions", "Terms and Condition", "Terms of Service"];

// [{ text, tab? }]: the sentence cut around the document names it contains
// (tab = 0 Terms of Use, 1 Privacy Policy), then the ones it doesn't. Each
// name lists the wordings to look for, first match wins; a name not found
// is linked with its first wording.
const splitTermsSentence = (sentence, names) => {
    const s = String(sentence || "");
    const lower = s.toLowerCase();
    // A case mapping that changes the length would shift every index.
    const searchable = lower.length === s.length;
    const found = [];
    const missing = [];
    names.forEach(({ texts, tab }) => {
        const wordings = (Array.isArray(texts) ? texts : [texts]).map((x) => String(x || "")).filter(Boolean);
        let hit = null;
        for (const name of wordings) {
            const at = searchable ? lower.indexOf(name.toLowerCase()) : -1;
            if (at === -1) continue;
            if (found.some((f) => at < f.end && f.start < at + name.length)) continue;
            hit = { start: at, end: at + name.length, tab };
            break;
        }
        if (hit) found.push(hit);
        else missing.push({ text: wordings[0] || "", tab });
    });
    found.sort((a, b) => a.start - b.start);
    const parts = [];
    let cursor = 0;
    found.forEach(({ start, end, tab }) => {
        if (start > cursor) parts.push({ text: s.slice(cursor, start) });
        parts.push({ text: s.slice(start, end), tab }); // the sentence's own wording and case
        cursor = end;
    });
    if (cursor < s.length) parts.push({ text: s.slice(cursor) });
    return { parts, missing: missing.filter((m) => m.text) };
};

const TermsAgreementLabel = memo(function TermsAgreementLabel({ classes, onOpenTerms }) {
    useLanguage();
    const { parts, missing } = splitTermsSentence(t(TERMS_AGREEMENT_KEY), [
        { texts: [t(TERMS_MODAL_TITLE_KEYS[0]), ...TERMS_ENGLISH_WORDINGS], tab: 0 },
        { texts: [t(TERMS_MODAL_TITLE_KEYS[1])], tab: 1 },
    ]);
    // Inside the checkbox's <label>: preventDefault keeps the click from
    // reaching the checkbox, so following a link never ticks or unticks it.
    const link = (text, tab, key) => (
        <Link
            key={key}
            component="button"
            type="button"
            underline="always"
            color="inherit"
            className={classes.termsLink}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenTerms(tab);
            }}
        >
            {text}
        </Link>
    );
    return (
        <span>
            {parts.map((p, i) => (typeof p.tab === "number" ? link(p.text, p.tab, "p" + i) : p.text))}
            {missing.length > 0 && " ("}
            {missing.map((m, i) => (
                <React.Fragment key={"m" + m.tab}>
                    {i > 0 && " · "}
                    {link(m.text, m.tab)}
                </React.Fragment>
            ))}
            {missing.length > 0 && ")"}
        </span>
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Memoized Step 1: Generate (Username + collapsed Advanced Configuration)
// ─────────────────────────────────────────────────────────────────────────────
const StepGenerate = memo(function StepGenerate({
                                                    classes,
                                                    username,
                                                    usernameMessage,
                                                    usernameSyntaxError,
                                                    pendingUsernameValidation,
                                                    usernameAvailable,
                                                    seed,
                                                    seedMenuAnchor,
                                                    seedWordInput,
                                                    seedWordSuggestion,
                                                    password,
                                                    showPassword,
                                                    advancedOpen,
                                                    termsAccepted,
                                                    onToggleAdvanced,
                                                    onTermsToggle,
                                                    onOpenTerms,
                                                    onUsernameChange,
                                                    onSeedInput,
                                                    onBeforeSeedWordAdd,
                                                    onAddWithinSeed,
                                                    onDeleteWithinSeed,
                                                    onSetSeedPhraseAnchor,
                                                    onGenerateNewSeed,
                                                    onPasswordChange,
                                                    onClickShowPassword,
                                                    onMouseDownPassword,
                                                    capacity,
                                                    onRefreshCapacity,
                                                }) {
    useLanguage();
    // ── Capacity + refill countdown (greyscale, first view) ──────────────
    const refillAtMs = capacity && capacity.next_refill_at ? new Date(capacity.next_refill_at).getTime() : null;
    const [nowTick, setNowTick] = useState(Date.now());
    useEffect(() => {
        if (refillAtMs === null) return undefined;
        const id = setInterval(() => setNowTick(Date.now()), 1000);
        return () => clearInterval(id);
    }, [refillAtMs]);
    const remainMs = refillAtMs !== null ? refillAtMs - nowTick : null;
    const refillDue = remainMs !== null && remainMs <= 0;
    useEffect(() => {
        if (refillDue && onRefreshCapacity) onRefreshCapacity();
    }, [refillDue]);
    const fmtRemain = (ms) => {
        const totalS = Math.max(0, Math.floor(ms / 1000));
        const h = Math.floor(totalS / 3600);
        const m = Math.floor((totalS % 3600) / 60);
        const sec = totalS % 60;
        const pad = (n) => String(n).padStart(2, "0");
        return `${h}:${pad(m)}:${pad(sec)}`;
    };
    // readOnly mnemonic when this is a fresh account; editable when recovering.
    const readOnly = usernameAvailable || usernameSyntaxError || pendingUsernameValidation;

    const usernameEndAdornment = useMemo(() => (
        <Tooltip title={usernameSyntaxError.length > 0 ? t("components.create_account_dialog.warning_the_username_has_a_syntax_error"): pendingUsernameValidation ? t("components.create_account_dialog.wait_the_system_is_looking_for_an_existing"): usernameAvailable ? t("components.create_account_dialog.success_the_username_is_available"): t("components.create_account_dialog.info_you_can_recover_this_account_by")}>
            <InputAdornment position="end" className={classes.inputEndAdornment}>
                {usernameSyntaxError.length > 0 ?
                    <IconButton edge="end" disabled className={classes.buttonNotDisabled}>
                        <AccountAlert/>
                    </IconButton>:
                    pendingUsernameValidation ?
                        <Box position="relative" display="inline-flex">
                            <CircularProgress variant="indeterminate" className={classes.progressCircle} color="inherit" />
                            <Box
                                top={0}
                                left={0}
                                bottom={0}
                                right={0}
                                position="absolute"
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                            >
                                <IconButton edge="end" disabled className={classes.buttonNotDisabled}>
                                    <AccountQuestion/>
                                </IconButton>
                            </Box>
                        </Box>:
                        <IconButton edge="end" disabled className={classes.buttonNotDisabled}>
                            {usernameAvailable ? <AccountCheck/>: <AccountRemove/>}
                        </IconButton>
                }
            </InputAdornment>
        </Tooltip>
    ), [classes, usernameSyntaxError, pendingUsernameValidation, usernameAvailable]);

    const seedEndAdornment = useMemo(() => (
        <Tooltip title={!readOnly ? t("components.create_account_dialog.info_since_you_try_to_recover_you", {
            username: username
        }): t("components.create_account_dialog.click_to_generate_a_new_seed")}>
            <InputAdornment style={ST_POS_ABSOLUTE__RIGHT_16PX__BOT_24PX} position="end" className={classes.inputEndAdornment}>
                <IconButton className={!readOnly ? classes.buttonNotDisabled: ""} disabled={!readOnly} edge="end" style={ST_MT_NEG8} onClick={(e) => onSetSeedPhraseAnchor(e.currentTarget)}>
                    <SeedPlus/>
                </IconButton>
            </InputAdornment>
        </Tooltip>
    ), [classes, readOnly, username, onSetSeedPhraseAnchor]);

    const passwordEndAdornment = useMemo(() => (
        <Tooltip title={t("words.toggle_password_visibility")}>
            <InputAdornment position="end">
                <IconButton
                    edge="end"
                    aria-label={t("components.create_account_dialog.toggle_password_visibility_2")}
                    onClick={onClickShowPassword}
                    onMouseDown={onMouseDownPassword}
                >
                    {showPassword ? <Visibility /> : <VisibilityOff />}
                </IconButton>
            </InputAdornment>
        </Tooltip>
    ), [showPassword, onClickShowPassword, onMouseDownPassword]);

    return (
        <DialogContent key={"view-1"}>
            <FormControl fullWidth variant="outlined" style={{marginBottom: (usernameMessage.length > 0 && username.length > 0) ?  "8px": "16px"}}>
                <InputLabel htmlFor="outlined-adornment-username">{t("words.username")}</InputLabel>
                <OutlinedInput
                    id="outlined-adornment-username"
                    value={username}
                    onChange={onUsernameChange}
                    startAdornment={<InputAdornment position="start">@</InputAdornment>}
                    endAdornment={usernameEndAdornment}
                    labelWidth={60}
                    inputProps={{
                        autoCapitalize: "none",
                        autoCorrect: "off",
                        spellCheck: false,
                        autoComplete: "off",
                        style: { textTransform: "lowercase" },
                    }}
                />
            </FormControl>
            <Collapse in={usernameMessage.length > 0 && username.length > 0}>
                <Typography style={ST_FS_14PX__MB_16PX__MT_8PX} component="p" variant="body1">
                    {usernameMessage}
                </Typography>
            </Collapse>
            {/* The box (and the plain words) tick the agreement; only the
                underlined document names open the document. */}
            <FormControlLabel
                className={classes.termsRow}
                control={
                    <Checkbox
                        checked={termsAccepted}
                        onChange={onTermsToggle}
                        name="terms-agreement"
                    />
                }
                label={<TermsAgreementLabel classes={classes} onOpenTerms={onOpenTerms} />}
            />
            <div
                className={classes.advancedToggle}
                onClick={onToggleAdvanced}
                role="button"
                tabIndex={0}
                aria-expanded={advancedOpen}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleAdvanced(); } }}
            >
                <span className="advancedToggleLabel">{t("components.create_account_dialog.advanced_configuration")}</span>
                <ExpandMoreIcon className={`advancedToggleIcon${advancedOpen ? " open" : ""}`} />
            </div>
            <Collapse in={advancedOpen} timeout={300} unmountOnExit={false}>
                <div style={ST_PT_8}>
                    <ChipInput
                        style={{marginTop: 0, marginBottom: (seedWordSuggestion.length > 0 && seedWordInput.length > 0) ? 8: 16}}
                        fullWidth
                        variant="outlined"
                        label={t("components.create_account_dialog.mnemonic")}
                        placeholder={seed.length > 0 ? "": readOnly ? t("components.create_account_dialog.generate_a_new_seed_phrase"): t("components.create_account_dialog.enter_your_old_seed_phrase")}
                        readOnly={readOnly}
                        value={seed}
                        inputProps={{style: {minWidth: "64px"}}}
                        onBeforeAdd={onBeforeSeedWordAdd}
                        onUpdateInput={(e) => onSeedInput(e.target.value)}
                        onAdd={onAddWithinSeed}
                        onDelete={onDeleteWithinSeed}
                        endAdornment={seedEndAdornment}
                    />
                    <Collapse in={seedWordSuggestion.length > 0 && seedWordInput.length > 0}>
                        <Typography style={ST_FS_14PX__MB_16PX__MT_8PX} component="p" variant="body1">{t("components.create_account_dialog.possibilities", {
                            seedWordSuggestion: seedWordSuggestion.join(", ")
                        })}</Typography>
                    </Collapse>
                    <FormControl variant="outlined" fullWidth className={classes.passwordInput}>
                        <InputLabel htmlFor="password-input">{t("components.create_account_dialog.password_optional")}</InputLabel>
                        <OutlinedInput
                            id="password-input"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={onPasswordChange}
                            endAdornment={passwordEndAdornment}
                            labelWidth={155}
                        />
                    </FormControl>
                </div>
            </Collapse>
            {capacity && (
                <div className={classes.capacityCard}>
                    <div className={"capCol"}>
                        <span className={"capValue"}>{capacity.accounts_available}</span>
                        <span className={"capLabel"}>{t("components.create_account_dialog.accounts_still_available")}</span>
                    </div>
                    {remainMs !== null && (
                        <div className={"capCol capRight"}>
                            <span className={"capValue"}>{fmtRemain(remainMs)}</span>
                            <span className={"capLabel"}>{t("components.create_account_dialog.until_refill", { amount: capacity.refill_amount || 250 })}</span>
                        </div>
                    )}
                </div>
            )}
            <SeedPhraseMenu onGenerate={onGenerateNewSeed} anchorEl={seedMenuAnchor} onClose={() => onSetSeedPhraseAnchor(null)} />
        </DialogContent>
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Memoized Step 2: Verify
//   - Normal flow: phone number + SMS confirmation code
//   - Recovery flow: re-derive keys from the entered seed and match on-chain
// ─────────────────────────────────────────────────────────────────────────────
const PICKER_INPUT_PROPS = { autoComplete: "off", autoCorrect: "off", spellCheck: false };

// One row of the country picker. Memoized so narrowing the filter only
// re-renders rows that actually changed — each row carries an inline flag
// SVG, and the previous inline map re-rendered all ~240 of them (plus two
// fresh closures each) on every keystroke of the filter box.
const CountryPickerRow = memo(function CountryPickerRow({ iso, code, name, classes, onSelect }) {
    const RowFlag = FLAG_BY_COUNTRY[iso] || null;
    const handleClick = useCallback(() => onSelect(iso), [onSelect, iso]);
    const handleKeyDown = useCallback((e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(iso); }
    }, [onSelect, iso]);
    return (
        <div
            className={classes.countryPickerRow}
            onClick={handleClick}
            role="button"
            tabIndex={0}
            onKeyDown={handleKeyDown}
        >
            {RowFlag ? <span className={classes.dialFlag}><RowFlag /></span> : <span className={classes.dialFlag} />}
            <span className={"pickerName"}>{name}</span>
            <span className={"pickerPrefix"}>{"+" + code}</span>
        </div>
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Confirmation code: six boxes over one input
//   One box per character of the SMS code, all fed by ONE real <input> laid
//   transparent over them. Typing runs from box to box without the person
//   moving anything, Backspace takes back one character, and a whole code —
//   pasted, or offered by the keyboard straight from the SMS
//   (autocomplete="one-time-code") — fills every box at once. A tap anywhere
//   on the row lands in that input, so a long press still opens the native
//   paste menu. `value` is the bare code ("ABC12"), without the dash.
// ─────────────────────────────────────────────────────────────────────────────
const CODE_LENGTH = 6;
const CODE_SLOTS = [0, 1, 2, 3, 4, 5];
const CODE_GROUP = 3; // the dash goes before this box: ABC-123
const cleanCode = (raw) => String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const CodeBoxes = memo(function CodeBoxes({ classes, id, label, value, status, autoFocus, onChange }) {
    const inputRef = useRef(null);
    const [focused, setFocused] = useState(false);
    const [caret, setCaret] = useState(0);

    const readCaret = useCallback(() => {
        const el = inputRef.current;
        if (el && typeof el.selectionStart === "number") setCaret(el.selectionStart);
    }, []);
    // A tap puts the browser's caret wherever the invisible text happens to
    // be under the finger: typing always resumes after the last character.
    const caretToEnd = useCallback(() => {
        const el = inputRef.current;
        if (!el) return;
        const end = el.value.length;
        try { el.setSelectionRange(end, end); } catch (_) { /* no selection API */ }
        setCaret(end);
    }, []);

    // A code was just sent: be ready to take it (typed, or picked from the
    // keyboard's suggestion bar).
    useEffect(() => {
        if (!autoFocus || !inputRef.current) return;
        try { inputRef.current.focus(); } catch (_) {}
    }, [autoFocus]);

    // Only a real change goes up: a 7th character typed into a full code must
    // not send the same code to /verify-code again (each try counts against
    // the attempts the SMS allows). And the field itself is kept exactly what
    // the boxes show — a lowercase letter, a dash, an extra character never
    // linger in it, or the next Backspace would only remove those.
    const commit = useCallback((next) => {
        const el = inputRef.current;
        if (el && el.value !== next) el.value = next;
        if (next !== value) onChange(next);
    }, [onChange, value]);

    const handleChange = useCallback((e) => {
        commit(cleanCode(e.target.value).slice(0, CODE_LENGTH));
        readCaret();
    }, [commit, readCaret]);

    // A whole code replaces whatever was typed; a fragment goes in at the
    // caret. Only [A-Z0-9] is kept either way ("abc-123" → ABC123).
    const handlePaste = useCallback((e) => {
        let text = "";
        try { text = (e.clipboardData || window.clipboardData).getData("text") || ""; }
        catch (_) { return; } // let the browser paste; handleChange cleans it
        e.preventDefault();
        const pasted = cleanCode(text);
        if (!pasted) return;
        if (pasted.length >= CODE_LENGTH) {
            commit(pasted.slice(0, CODE_LENGTH));
            caretToEnd();
            return;
        }
        const el = inputRef.current;
        const start = el && typeof el.selectionStart === "number" ? el.selectionStart : value.length;
        const end = el && typeof el.selectionEnd === "number" ? el.selectionEnd : value.length;
        commit((value.slice(0, start) + pasted + value.slice(end)).slice(0, CODE_LENGTH));
        caretToEnd();
    }, [commit, caretToEnd, value]);

    const handleFocus = useCallback(() => {
        setFocused(true);
        // After the browser has placed its own caret from the tap.
        setTimeout(caretToEnd, 0);
    }, [caretToEnd]);
    const handleBlur = useCallback(() => setFocused(false), []);
    const focusInput = useCallback(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    // The box the next character goes to (the last one once all are full).
    const at = Math.min(caret, value.length, CODE_LENGTH - 1);
    const editable = status !== "ok" && status !== "pending";
    const boxClass = (i) => {
        let c = classes.codeBox;
        if (status === "ok") c += " " + classes.codeBoxOk;
        else if (status === "fail") c += " " + classes.codeBoxFail;
        else if (value[i]) c += " " + classes.codeBoxFilled;
        if (focused && editable && i === at) c += " " + classes.codeBoxActive;
        return c;
    };

    return (
        <div
            className={status === "fail" ? classes.codeBoxes + " " + classes.shake : classes.codeBoxes}
            onClick={focusInput}
        >
            {CODE_SLOTS.map((i) => (
                <React.Fragment key={i}>
                    {i === CODE_GROUP && <span className={classes.codeSeparator} aria-hidden="true" />}
                    <div className={boxClass(i)} aria-hidden="true">
                        {value[i] || (focused && editable && i === at ? <span className={classes.codeCaret} /> : null)}
                    </div>
                </React.Fragment>
            ))}
            <input
                ref={inputRef}
                id={id}
                className={classes.codeInput}
                type="text"
                value={value}
                onChange={handleChange}
                onPaste={handlePaste}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onClick={caretToEnd}
                onKeyUp={readCaret}
                aria-label={label}
                inputMode="text"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                autoCorrect="off"
                // A string: Preact drops a `false` attribute instead of writing
                // spellcheck="false", and the squiggle would show under the boxes.
                spellCheck="false"
            />
        </div>
    );
});

const StepVerify = memo(function StepVerify({
                                                classes,
                                                recoveryMode,
                                                // shared
                                                onVerifyRecovery,
                                                recoveryStatus,        // 'idle' | 'pending' | 'ok' | 'fail'
                                                seed,
                                                // phone flow
                                                dialCode,
                                                country,
                                                phoneRaw,
                                                phoneFormatted,
                                                phoneMask,
                                                codeSent,
                                                sendingCode,
                                                confirmationCode,
                                                codeStatus,            // 'idle' | 'pending' | 'ok' | 'fail'
                                                onDialCodeChange,
                                                onPhoneChange,
                                                onPhonePaste,
                                                onSendCode,
                                                onCodeChange,
                                                onVerifyCode,
                                                sendError,
                                                phoneError,            // the number itself refused by /send-code
                                                codeError,
                                                resendInSec,
                                                capacity,
                                                phoneCheck,
                                                phoneChecking,
                                                nextSendAllowedAt,
                                                onCountrySelect,
                                            }) {
    useLanguage();
    // ── Country picker (opened by clicking the flag / dial code) ─────────
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerFilter, setPickerFilter] = useState("");
    const regionNames = useMemo(() => {
        try { return new Intl.DisplayNames([getLocaleCode()], { type: "region" }); }
        catch (_) { return null; }
    }, [getLocaleCode()]);
    const pickerEntries = useMemo(() => {
        const named = countryEntries().map(({ iso, code }) => {
            const name = regionNameOf(regionNames, iso);
            // Lower-cased once here: the filter below used to lower-case every
            // name and iso again on every keystroke (~240 entries × 2).
            return { iso, code, name, lname: name.toLowerCase(), liso: iso.toLowerCase() };
        });
        return named.sort((a, b) => a.name.localeCompare(b.name));
    }, [regionNames]);
    // A whole phone number pasted or typed into the search box ("+33 6 12 34
    // 56 78", "0033…", "33612345678"): recognise its country so the list
    // offers it, and hand the number over when that country is selected.
    // Without a "+"/"00", five digits or more are needed before a search is
    // read as a number rather than as a dial code being typed.
    const pickerNumber = useMemo(() => {
        const parsed = parsePhoneInput(pickerFilter);
        if (!parsed.digits || (!parsed.intl && parsed.digits.length < 5)) return null;
        const match = matchCountryByPrefix(parsed.digits);
        return match ? { country: match.country, digits: parsed.digits } : null;
    }, [pickerFilter]);
    const filteredEntries = useMemo(() => {
        const q = pickerFilter.trim().toLowerCase();
        if (!q) return pickerEntries;
        if (pickerNumber) {
            const hit = pickerEntries.filter((e) => e.iso === pickerNumber.country);
            if (hit.length > 0) return hit;
        }
        const qDigits = q.replace(/\D/g, "");
        return pickerEntries.filter((e) =>
            e.lname.indexOf(q) !== -1 ||
            e.liso === q ||
            (qDigits.length > 0 && e.code.indexOf(qDigits) === 0)
        );
    }, [pickerEntries, pickerFilter, pickerNumber]);
    // Stable: were re-created per render, which also forced every memo'd
    // CountryPickerRow below to re-render on each filter keystroke.
    const openPicker = useCallback(() => { setPickerFilter(""); setPickerOpen(true); }, []);
    const closePicker = useCallback(() => setPickerOpen(false), []);
    const selectCountry = useCallback((iso) => {
        setPickerOpen(false);
        if (onCountrySelect) onCountrySelect(iso, pickerNumber && pickerNumber.country === iso ? pickerNumber.digits : undefined);
    }, [onCountrySelect, pickerNumber]);
    const onPickerFilterChange = useCallback((e) => setPickerFilter(e.target.value), []);
    // Enter with a single remaining entry selects it — one keystroke after
    // pasting a number or finishing a country name.
    const onPickerFilterKeyDown = useCallback((e) => {
        if (e.key === "Enter" && filteredEntries.length === 1) {
            e.preventDefault();
            selectCountry(filteredEntries[0].iso);
        }
    }, [filteredEntries, selectCountry]);
    // ── Turnstile (bot gate for /send-code) ──────────────────────────────
    // One invisible widget ("interaction-only": nothing is shown unless
    // Cloudflare needs the user to click) rendered in execute mode, so the
    // challenge only runs when the user presses SEND. Each click resets the
    // widget first — tokens are single-use — and waits for a fresh token,
    // which is handed to onSendCode(token). All hooks live above the
    // recovery-mode early return, as React requires.
    const turnstileHost = useRef(null);              // container <div>
    const turnstileWidget = useRef(null);            // { ts, id, pending }
    const [challenging, setChallenging] = useState(false);
    const [turnstileState, setTurnstileState] = useState(TURNSTILE_SITE_KEY ? "loading" : "off"); // off|loading|ready|error
    useEffect(() => {
        if (!TURNSTILE_SITE_KEY || recoveryMode) return undefined;
        let cancelled = false;
        const settle = (fn) => {
            const w = turnstileWidget.current;
            const p = w && w.pending;
            if (!p) return;
            w.pending = null;
            fn(p);
        };
        loadTurnstile().then((ts) => {
            if (cancelled || !turnstileHost.current || !ts) return;
            const id = ts.render(turnstileHost.current, {
                sitekey: TURNSTILE_SITE_KEY,
                action: "send-code",
                execution: "execute",            // run only on turnstile.execute()
                appearance: "interaction-only",  // visible only when a click is required
                size: "flexible",
                theme: "dark",
                language: "auto",
                "refresh-expired": "manual",     // we reset before every execute anyway
                callback: (token) => settle((p) => p.resolve(token)),
                "error-callback": (code) => { settle((p) => p.resolve(null)); return true; },
                "expired-callback": () => settle((p) => p.resolve(null)),
                "timeout-callback": () => settle((p) => p.resolve(null)),
            });
            turnstileWidget.current = { ts, id, pending: null };
            setTurnstileState("ready");
        }).catch(() => { if (!cancelled) setTurnstileState("error"); });
        return () => {
            cancelled = true;
            const w = turnstileWidget.current;
            turnstileWidget.current = null;
            if (w) { try { w.ts.remove(w.id); } catch (_) { /* already gone */ } }
        };
    }, [recoveryMode]);
    // Resolve to a token, or to null when the gate is off / unavailable /
    // too slow — the worker is the authority on whether null is acceptable.
    const acquireTurnstileToken = useCallback(() => {
        const w = turnstileWidget.current;
        if (!TURNSTILE_SITE_KEY || !w) return Promise.resolve(null);
        return new Promise((resolve) => {
            let done = false;
            const finish = (token) => { if (done) return; done = true; clearTimeout(timer); resolve(token || null); };
            const timer = setTimeout(() => { if (w.pending) w.pending = null; finish(null); }, TURNSTILE_TIMEOUT_MS);
            w.pending = { resolve: finish };
            try {
                w.ts.reset(w.id);
                w.ts.execute(w.id);
            } catch (_) {
                w.pending = null;
                finish(null);
            }
        });
    }, []);
    const handleSendClick = useCallback(async () => {
        setChallenging(true);
        let token = null;
        try { token = await acquireTurnstileToken(); } finally { setChallenging(false); }
        onSendCode(token);
    }, [acquireTurnstileToken, onSendCode]);
    // ── Recovery branch: show what the user entered and try to derive/match.
    if (recoveryMode) {
        const enoughSeed = [12, 15, 18, 21, 24].indexOf(seed.length) !== -1;
        return (
            <DialogContent key={"view-2-recovery"}>
                <Typography style={ST_FS_14__MB_16__MT_8}>
                    {t("components.create_account_dialog.recovery_we_will_derive_the_keys_from")}
                </Typography>
                <Typography style={ST_FS_13__MB_24__C_7B7B7B}>{t("components.create_account_dialog.seed_length_word", {
                    word: { word: seed.length },
                    enoughSeed: !enoughSeed && (" — " + t("components.create_account_dialog.expected_12_15_18_21_or_24"))
                })}</Typography>
                <div style={ST_TA_RIGHT}>
                    <Button
                        variant="contained"
                        color="default"
                        onClick={onVerifyRecovery}
                        disabled={!enoughSeed || recoveryStatus === "pending" || recoveryStatus === "ok"}
                    >
                        {recoveryStatus === "pending" ? t("components.create_account_dialog.verifying") :
                            recoveryStatus === "ok"      ? t("components.create_account_dialog.verified") :
                                t("components.create_account_dialog.verify_seed")}
                    </Button>
                </div>
                <Collapse in={recoveryStatus === "fail"}>
                    <Typography style={ST_FS_14__MT_16__C_BDBDBD}>
                        {t("components.create_account_dialog.the_seed_you_entered_does_not_match")}
                    </Typography>
                </Collapse>
                <Collapse in={recoveryStatus === "ok"}>
                    <Typography style={ST_FS_14__MT_16__C_FFFFFF}>
                        {t("components.create_account_dialog.seed_verified_you_can_continue")}
                    </Typography>
                </Collapse>
            </DialogContent>
        );
    }

    // ── Normal flow: phone verification.
    const noCapacity = Boolean(capacity) && capacity.accounts_available === 0;
    // Pre-flight verdict for the typed number: block the send button when the
    // worker says this phone cannot receive an SMS (consumed / lifetime cap /
    // 7-day window). "verified" is not a block — it means skip the SMS.
    const blockedByCheck = Boolean(phoneCheck) && !phoneCheck.can_send && phoneCheck.phone_status !== "verified";
    const sendLockedByWindow = Boolean(nextSendAllowedAt) && Date.now() < new Date(nextSendAllowedAt).getTime();
    // A "+…" typed or pasted into the number field that matches no offered
    // country stays visible there (with `phoneRaw` empty, so SEND is off) —
    // explain it the same way as an unsupported dial code.
    const typedUnsupported = String(phoneFormatted || "").startsWith("+") && destSupport(phoneFormatted) === "unsupported";
    const countryUnsupported = destSupport(dialCode) === "unsupported" || typedUnsupported;
    const sendDisabled = sendingCode || challenging || phoneRaw.length < 4 || resendInSec > 0 || noCapacity || blockedByCheck || sendLockedByWindow || countryUnsupported || Boolean(phoneError);
    // More digits than any of the country's masks: shown in full, never cut.
    // Usually a foreign number entered without its "+" — the country switches
    // by itself once the number is complete, otherwise this note says what to
    // do. Sending stays possible: the masks are a formatting aid, the worker
    // and the SMS provider decide what is deliverable.
    const maxDigits = slotRange(country).max;
    const phoneTooLong = maxDigits > 0 && phoneRaw.length > maxDigits;
    const countryName = regionNameOf(regionNames, country);
    // One-line status under the phone field, fed by /check-phone.
    let phoneNote = "";
    if (countryUnsupported) {
        phoneNote = t("components.create_account_dialog.sms_verification_is_not_yet_available_for");
    } else if (phoneTooLong) {
        phoneNote = t("components.create_account_dialog.digits_numbers_in_have_at_most_for", { digits: phoneRaw.length, country: countryName, max: maxDigits });
    } else if (turnstileState === "error") {
        phoneNote = t("components.create_account_dialog.the_browser_check_could_not_load_if_you");
    } else if (phoneChecking) {
        phoneNote = t("components.create_account_dialog.checking_number");
    } else if (phoneCheck) {
        const nextAt = phoneCheck.next_send_allowed_at
            ? new Date(phoneCheck.next_send_allowed_at).toLocaleString(getLocaleCode())
            : null;
        if (phoneCheck.phone_status === "consumed" || phoneCheck.phone_status === "pending_creation") {
            phoneNote = t("components.create_account_dialog.this_phone_number_has_already_been_used");
        } else if (phoneCheck.phone_status === "send_limit_reached") {
            phoneNote = t("components.create_account_dialog.this_number_has_reached_the_maximum_of", { max: phoneCheck.sends_max_total });
        } else if (phoneCheck.phone_status === "cooldown") {
            phoneNote = nextAt
                ? t("components.create_account_dialog.an_sms_was_already_sent_to_this_number_the", { date: nextAt })
                : t("components.create_account_dialog.an_sms_was_already_sent_to_this_number");
        } else if (phoneCheck.phone_status === "verified") {
            phoneNote = t("components.create_account_dialog.this_phone_is_already_verified_you_can");
        }
    }
    // Shown right under the phone field: everything said about the number
    // itself — the /check-phone verdict, or /send-code refusing it.
    const fieldNote = phoneError || phoneNote;
    const fieldNoteColor = !phoneError && phoneCheck && phoneCheck.phone_status === "verified" ? "#ffffff" : "#bdbdbd";

    // The code as typed, without the dash the state keeps ("ABC-12" → "ABC12").
    const codeChars = String(confirmationCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const verifyDisabled =
        codeStatus === "pending" ||
        codeStatus === "ok" ||
        codeChars.length < CODE_LENGTH;

    // Beside the boxes: the verification state (also a manual retry, e.g.
    // after a network error — a full code is otherwise verified by itself).
    const codeStatusIndicator = codeStatus === "ok" ? (
        <Tooltip title={t("components.create_account_dialog.code_verified")}>
            <span>
                <IconButton disabled>
                    <CheckCircleOutlineIcon style={ST_C_FFFFFF} />
                </IconButton>
            </span>
        </Tooltip>
    ) : codeStatus === "pending" ? (
        <CircularProgress size={22} color="inherit" />
    ) : (
        <Tooltip title={t("components.create_account_dialog.verify_the_confirmation_code")}>
            <span>
                <IconButton onClick={onVerifyCode} disabled={verifyDisabled}>
                    <CheckCircleOutlineIcon />
                </IconButton>
            </span>
        </Tooltip>
    );

    // Dial-code start adornment: an inline editable "+41" label. Editing it
    // changes the country (and thus the mask). Lives as a borderless small
    // input so it reads as part of the field, not a separate control.
    // Country flag for the resolved dial code — falls back to the generic
    // phone glyph while the typed prefix doesn't resolve to a known country.
    const FlagComponent = FLAG_BY_COUNTRY[country] || null;

    const dialAdornment = (
        <InputAdornment position="start" style={ST_MR_8}>
            {FlagComponent ? (
                <Tooltip title={country}>
                    <span className={classes.dialFlag} style={ST_CUR_POINTER} onClick={openPicker}><FlagComponent /></span>
                </Tooltip>
            ) : (
                <PhoneIcon style={ST_C_7B7B7B__MR_8__CUR_POINTER} onClick={openPicker} />
            )}
            <Tooltip title={t("components.create_account_dialog.country_dialing_code")}>
                <button
                    type="button"
                    className={classes.dialCodeButton}
                    onClick={openPicker}
                    aria-label={t("components.create_account_dialog.country_dialing_code")}
                    aria-haspopup="dialog"
                    style={{ width: `${Math.max(3, (dialCode || "+").length + 1)}ch`, minWidth: "3ch" }}
                >
                    {dialCode || "+"}
                </button>
            </Tooltip>
        </InputAdornment>
    );

    return (
        <DialogContent key={"view-2"}>
            <FormControl variant="outlined" fullWidth style={ST_MB_16__MT_8}>
                <InputLabel htmlFor="phone-input" shrink>{t("components.create_account_dialog.phone_number")}</InputLabel>
                <OutlinedInput
                    id="phone-input"
                    type="tel"
                    value={phoneFormatted}
                    onChange={onPhoneChange}
                    onPaste={onPhonePaste}
                    startAdornment={dialAdornment}
                    placeholder={phoneMask || ""}
                    labelWidth={100}
                    notched
                    inputProps={{ autoComplete: "tel-national", inputMode: "tel" }}
                />
            </FormControl>
            {/* About the number itself ("This phone number has already been
                used to create an account.", unsupported country, too long…):
                right under the field it is about, not under the button. */}
            <Collapse in={Boolean(fieldNote)}>
                <Typography style={{ fontSize: 13, marginTop: -8, marginBottom: 12, color: fieldNoteColor, fontStyle: "italic", textAlign: "left" }}>
                    {fieldNote}
                </Typography>
            </Collapse>
            {/* Turnstile mount point — empty unless Cloudflare needs a click. */}
            <div ref={turnstileHost} style={turnstileState === "off" ? ST_DISPLAY_NONE : ST_MB_8} />
            <Button
                fullWidth
                variant="contained"
                color="default"
                onClick={handleSendClick}
                disabled={sendDisabled}
                startIcon={(sendingCode || challenging) ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                style={ST_MB_16}
            >
                {challenging ? t("components.create_account_dialog.checking_browser") :
                    sendingCode ? t("components.create_account_dialog.sending") :
                        resendInSec > 0 ? t("components.create_account_dialog.resend_in_s", {
                                resendInSec: resendInSec
                            }) :
                            codeSent ? t("components.create_account_dialog.resend_confirmation_code") : t("components.create_account_dialog.send_confirmation_code")}
            </Button>
            {capacity && (
                <Typography style={ST_FS_12__MT_NEG8__MB_8}>
                    {noCapacity
                        ? t(
                            "components.create_account_dialog.daily_capacity_reached_new_account_slots_open",
                            {
                                toLocaleTimeString: capacity.next_refill_at ? new Date(capacity.next_refill_at).toLocaleString(getLocaleCode()) : t("components.create_account_dialog.the_next_utc_midnight")
                            }
                        )
                        : t("components.create_account_dialog.account_slot_available_today", {
                            account_slot: { account_slot: capacity.accounts_available },
                        })}
                </Typography>
            )}
            <Collapse in={Boolean(sendError)}>
                <Typography style={ST_FS_14__MB_12__C_BDBDBD}>
                    {sendError}
                </Typography>
            </Collapse>
            <Collapse in={codeSent}>
                <label className={classes.codeLabel} htmlFor="confirmation-code-input">
                    {t("components.create_account_dialog.confirmation_code")}
                </label>
                <div className={classes.codeRow}>
                    <CodeBoxes
                        classes={classes}
                        id="confirmation-code-input"
                        label={t("components.create_account_dialog.confirmation_code")}
                        value={codeChars}
                        status={codeStatus}
                        autoFocus={codeSent && codeStatus !== "ok"}
                        onChange={onCodeChange}
                    />
                    <div className={classes.codeStatus}>
                        {codeStatusIndicator}
                    </div>
                </div>
                <Collapse in={codeStatus === "fail"}>
                    <Typography style={ST_FS_14__MT_12__C_BDBDBD}>
                        {codeError || t("components.create_account_dialog.that_code_doesnt_match_double_check_the_sms")}
                    </Typography>
                </Collapse>
                <Collapse in={codeStatus === "ok"}>
                    <Typography style={ST_FS_14__MT_12__C_FFFFFF}>
                        {t("components.create_account_dialog.verified_you_can_continue")}
                    </Typography>
                </Collapse>
            </Collapse>
            {/* Country picker — opened by clicking the flag / dial code. */}
            <Dialog
                className={classes.countryPickerDialog}
                open={pickerOpen}
                onClose={closePicker}
                fullWidth={true}
                maxWidth={"xs"}
            >
                <DialogTitle>{t("components.create_account_dialog.select_your_country")}</DialogTitle>
                <DialogContent style={ST_PT_0}>
                    <FormControl fullWidth variant="outlined">
                        <OutlinedInput
                            autoFocus
                            value={pickerFilter}
                            onChange={onPickerFilterChange}
                            onKeyDown={onPickerFilterKeyDown}
                            placeholder={t("components.create_account_dialog.search_country_code_or_paste_a_number")}
                            inputProps={PICKER_INPUT_PROPS}
                        />
                    </FormControl>
                    <div className={classes.countryPickerList}>
                        {filteredEntries.map(({ iso, code, name }) => (
                            <CountryPickerRow
                                key={iso}
                                iso={iso}
                                code={code}
                                name={name}
                                classes={classes}
                                onSelect={selectCountry}
                            />
                        ))}
                        {filteredEntries.length === 0 && (
                            <Typography style={ST_FS_14__C_7B7B7B__P_12PX_4PX}>
                                {t("components.create_account_dialog.no_country_matches_your_search")}
                            </Typography>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </DialogContent>
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Memoized Step 3: Confirm
//   Creation/recovery progress, then the backup PDF — which has to be saved
//   before the dialog can close. Where the browser offers a real "Save as"
//   (File System Access), the save is known to have happened; anywhere else
//   a plain download is all a page can start, and whether the file was kept
//   or the download cancelled can't be seen — so the person confirms it.
//   Closing a finished sign-up then signs the new account in (the class's
//   _signInAndClose); this panel says so, and shows how it went.
// ─────────────────────────────────────────────────────────────────────────────
const ST_PDF_NOTE = { color: "#bdbdbd", fontSize: 13, textAlign: "center", maxWidth: 420, fontStyle: "italic" };
const ST_PDF_SAVED = { color: "#ffffff", fontSize: 14, textAlign: "center", maxWidth: 420 };
const ST_PDF_REMINDER = { color: "#ffffff", fontSize: 14, fontWeight: 500, textAlign: "center", maxWidth: 420 };
const PDF_NOTICE_KEYS = {
    cancelled: "components.create_account_dialog.the_download_was_cancelled_your_backup_isnt",
    failed: "components.create_account_dialog.the_pdf_couldnt_be_saved_please_try_again",
};

const StepConfirm = memo(function StepConfirm({
                                                  classes,
                                                  status,           // 'working' | 'success' | 'error'
                                                  recoveryMode,
                                                  errorMessage,
                                                  hasPdfBlob,
                                                  pdfDownloaded,    // a download / save was started
                                                  pdfSaving,        // the "Save as" write is running
                                                  pdfVerified,      // written through "Save as": known saved
                                                  pdfConfirmed,     // verified, or confirmed by the person
                                                  pdfNotice,        // '' | 'cancelled' | 'failed'
                                                  pdfReminder,      // closes refused so far (re-runs the shake)
                                                  username,
                                                  signInState,      // 'idle' | 'pending' | 'done' | 'failed'
                                                  signInError,
                                                  onDownloadPdf,
                                                  onTogglePdfConfirmed,
                                              }) {
    useLanguage();
    return (
        <DialogContent key={"view-3"}>
            <div className={classes.statusPanel}>
                {status === "working" && (
                    <>
                        <CircularProgress color="inherit" />
                        <Typography style={ST_C_BDBDBD__FS_14__TA_CENTER}>
                            {recoveryMode ? t("components.create_account_dialog.recovering_your_account") : t("components.create_account_dialog.creating_your_account_on_pixa")}
                        </Typography>
                    </>
                )}
                {status === "success" && (
                    <>
                        <CheckCircleOutlineIcon className={classes.statusIconSuccess} />
                        <Typography style={ST_C_FFF__FS_16__TA_CENTER}>
                            {recoveryMode
                                ? t("components.create_account_dialog.account_recovered_youre_signed_in")
                                : t("components.create_account_dialog.account_created")}
                        </Typography>

                        {hasPdfBlob && (
                            <Button
                                variant={pdfDownloaded ? "outlined" : "contained"}
                                color="default"
                                onClick={onDownloadPdf}
                                disabled={pdfSaving}
                                startIcon={pdfSaving ? <CircularProgress size={16} color="inherit" /> : null}
                                style={ST_MT_8}
                            >
                                {pdfSaving ? t("components.create_account_dialog.saving") : pdfDownloaded ? t("components.create_account_dialog.download_again") : t("components.create_account_dialog.download_backup_pdf")}
                            </Button>
                        )}

                        {hasPdfBlob && !pdfDownloaded && (
                            <Typography style={ST_C_BDBDBD__FS_13__TA_CENTER}>
                                {t(
                                    "components.create_account_dialog.you_must_download_your_backup_pdf_before"
                                )}
                            </Typography>
                        )}

                        {hasPdfBlob && pdfNotice && PDF_NOTICE_KEYS[pdfNotice] && (
                            <Typography style={ST_PDF_NOTE}>{t(PDF_NOTICE_KEYS[pdfNotice])}</Typography>
                        )}

                        {hasPdfBlob && pdfVerified && (
                            <Typography style={ST_PDF_SAVED}>
                                {t("components.create_account_dialog.backup_pdf_saved_keep_it_somewhere_safe_it")}
                            </Typography>
                        )}

                        {hasPdfBlob && pdfDownloaded && !pdfVerified && (
                            <>
                                <Typography style={ST_PDF_NOTE}>
                                    {t("components.create_account_dialog.check_that_the_download_finished_if_it_was")}
                                </Typography>
                                <FormControlLabel
                                    className={classes.termsRow}
                                    control={
                                        <Checkbox
                                            checked={pdfConfirmed}
                                            onChange={onTogglePdfConfirmed}
                                            name="backup-saved"
                                        />
                                    }
                                    label={t("components.create_account_dialog.i_have_saved_my_backup_pdf")}
                                />
                            </>
                        )}

                        {hasPdfBlob && pdfReminder > 0 && !pdfConfirmed && (
                            <Typography key={pdfReminder} className={classes.shake} style={ST_PDF_REMINDER}>
                                {t("components.create_account_dialog.save_your_backup_pdf_before_closing_it_is")}
                            </Typography>
                        )}

                        {/* A new account is signed in as the dialog closes
                            (_signInAndClose): said once the backup is saved. */}
                        {!recoveryMode && (!hasPdfBlob || pdfConfirmed) && signInState === "idle" && (
                            <Typography style={ST_PDF_NOTE}>
                                {t("components.create_account_dialog.youll_be_signed_in_as_when_you_close", { username })}
                            </Typography>
                        )}
                        {signInState === "pending" && (
                            <Typography style={ST_PDF_SAVED}>
                                {t("components.create_account_dialog.signing_you_in_as", { username })}
                            </Typography>
                        )}
                        {signInState === "failed" && (
                            <Typography style={ST_PDF_REMINDER}>
                                {signInError
                                    ? t("components.create_account_dialog.you_couldnt_be_signed_in_error_try_again", {
                                        error: String(signInError).replace(/[\s.。．।]+$/u, ""), // its own full stop: the sentence adds one
                                    })
                                    : t("components.create_account_dialog.you_couldnt_be_signed_in_try_again_or")}
                            </Typography>
                        )}
                    </>
                )}
                {status === "error" && (
                    <Typography style={ST_C_BDBDBD__FSTY_ITALIC__FS_14}>
                        {errorMessage || t("components.create_account_dialog.something_went_wrong_please_try_again")}
                    </Typography>
                )}
            </div>
        </DialogContent>
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Dialog Component
// ─────────────────────────────────────────────────────────────────────────────
// SwipeableViews config — were object literals re-created per render.
const SWIPE_CONTAINER_STYLE = { height: "100%" };
const SWIPE_SPRING_CONFIG = { tension: 450, friction: 60, duration: '360ms', easeFunction: 'cubic-bezier(0.280, 0.840, 0.420, 1)', delay: '5ms' };

class CreateAccountDialog extends React.PureComponent {

    constructor(props) {
        super(props);
        // Hidden form ref for browser credential save
        this._credentialFormRef = React.createRef();
        // Set by the quit modal's QUIT: from then on every close goes through
        // (the shell asks again when the address drops the overlay).
        this._quitConfirmed = false;
        // Set by CLOSE after a failed sign-in: leave the finished sign-up
        // without signing in.
        this._leaveSignedOut = false;
        // A sign-in is running (_signInAndClose). An instance flag, not state:
        // two closes in one tick (a double click, Escape and the back arrow)
        // must not start two sign-ins before the state catches up.
        this._signingIn = false;
        // An await that resolves after the dialog is gone must not touch it.
        this._unmounted = false;
        this._advancedOpenTimer = null;
        this._resendTimer = null;
        this._phoneCheckTimer = null;
        const _country = detectBrowserCountry();
        const _initialDialDigits = dialCodeFor(_country) || "";
        const _initialDialCode = _initialDialDigits ? "+" + _initialDialDigits : "+";
        const _initialSubscriberMask = pickSubscriberMask(_country, 0) || "";
        this.state = {
            classes: props.classes,
            keepMounted: props.keepMounted || false,
            open: props.open,
            api: props.api,
            _tab_value: 0,
            _password: "",
            _showPassword: true,
            _seed_word_input: "",
            _seed_word_suggestion: [],
            _seed: [],
            _showSeed: false,
            _seed_menu_anchor: null,
            _username: "",
            _username_syntax_error: false,
            _pending_username_validation: false,
            _username_available: false,
            _downloaded: false,
            _pdfBlob: null,                // generated up-front, downloaded at step 2 success
            _pdfDownloaded: false,         // a download / "Save as" has been started
            _pdfSaving: false,             // the "Save as" write is running
            _pdfVerified: false,           // written through "Save as": known to be saved
            _pdfConfirmed: false,          // verified, or the person confirmed it was saved
            _pdfNotice: "",                // '' | 'cancelled' | 'failed'
            _pdfReminder: 0,               // closes refused for an unsaved backup
            _quitConfirmOpen: false,       // the white "Quit the sign-up?" modal
            _signInState: "idle",          // 'idle'|'pending'|'done'|'failed' — the sign-in on close
            _signInError: "",
            _creating_account: false,
            _fullscreen: viewportWidth() <= 960,
            _compactStepper: viewportWidth() <= COMPACT_STEPPER_MAX_WIDTH,
            _publicKeys: {
                owner: "",
                active: "",
                posting: "",
                memo: ""
            },
            _privateKeys: {
                owner: "",
                active: "",
                posting: "",
                memo: ""
            },
            // ── New flow state ───────────────────────────────────────────────
            // Step 0: Advanced Configuration collapse open/closed
            _advancedOpen: false,
            // Step 0: Terms of Use / Privacy Policy agreement + its modal
            // (_termsTab: 0 = Terms of Use, 1 = Privacy Policy)
            _termsAccepted: false,
            _termsModalOpen: false,
            _termsTab: 0,
            // True once a taken username has been detected (auto-cleared seed
            // and the user can now enter their own to recover).
            _recoveryMode: false,
            // Step 1: phone verification (subscriber-only — country code lives
            // in _dialCode, not in _phoneRaw)
            _country: _country,
            _dialCode: _initialDialCode,
            _phoneRaw: "",                  // subscriber digits only
            _phoneFormatted: "",            // subscriber formatted under mask
            _phoneMask: _initialSubscriberMask,
            _codeSent: false,
            _sendingCode: false,
            _confirmationCode: "",
            _codeStatus: "idle",           // 'idle'|'pending'|'ok'|'fail'
            _sendError: "",                // server message shown under the send button
            _phoneError: "",               // /send-code refused the number itself — shown under the phone field
            _codeError: "",                // server message shown under the code field
            _resendInSec: 0,               // resend-button cooldown countdown
            _voucher: null,                // account-creation voucher from /verify-code
            _voucherExpiresAt: null,       // unix seconds
            _capacity: null,               // GET /capacity snapshot (cosmetic; null on failure)
            _phoneCheck: null,             // POST /check-phone snapshot for the typed number
            _phoneChecking: false,         // a /check-phone request is in flight
            _nextSendAllowedAt: null,      // ISO — when this phone may receive its next SMS
            // Step 1 (recovery branch): seed verification status
            _recoveryStatus: "idle",       // 'idle'|'pending'|'ok'|'fail'
            // Step 2: final confirm/status panel
            _confirmStatus: "idle",        // 'idle'|'working'|'success'|'error'
            _errorMessage: "",
        };
    };

    componentDidMount() {
        window.addEventListener("resize", this._computeSize);
        this._fetchCapacity();
        // The shell asks this dialog before the address takes it down (the
        // back arrow, a link — Index.js §8c): see _closeGuard.
        if (typeof this.props.registerCloseGuard === "function") {
            this.props.registerCloseGuard(this._closeGuard);
        }
        // Mirror the visual viewport into CSS variables. When the on-screen
        // keyboard opens, mobile browsers shrink the visual viewport without
        // resizing the layout viewport, so a `height: 100%` fullscreen dialog
        // keeps its full height and its bottom action bar ends up behind the
        // keyboard. The fullscreen paper consumes these variables instead.
        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", this._updateVisualViewport);
            window.visualViewport.addEventListener("scroll", this._updateVisualViewport);
            this._updateVisualViewport();
        }
    }

    componentWillUnmount() {
        this._unmounted = true;
        window.removeEventListener("resize", this._computeSize);
        if (window.visualViewport) {
            window.visualViewport.removeEventListener("resize", this._updateVisualViewport);
            window.visualViewport.removeEventListener("scroll", this._updateVisualViewport);
        }
        document.documentElement.style.removeProperty("--cad-vvh");
        document.documentElement.style.removeProperty("--cad-vvt");
        if (typeof this.props.registerCloseGuard === "function") {
            this.props.registerCloseGuard(null);
        }
        if (this._advancedOpenTimer)  { clearTimeout(this._advancedOpenTimer);  this._advancedOpenTimer = null; }
        if (this._resendTimer)        { clearInterval(this._resendTimer);       this._resendTimer = null; }
        if (this._phoneCheckTimer)    { clearTimeout(this._phoneCheckTimer);    this._phoneCheckTimer = null; }
    }

    // Writes visualViewport height/offset into CSS custom properties consumed
    // by `.MuiDialog-paperFullScreen` (see styles.dialog). Height pins the
    // paper's bottom edge to the top of the keyboard; offsetTop keeps the
    // paper aligned when iOS Safari scrolls the page on input focus.
    _updateVisualViewport = () => {
        const vv = window.visualViewport;
        if (!vv) { return; }
        document.documentElement.style.setProperty("--cad-vvh", `${Math.round(vv.height)}px`);
        document.documentElement.style.setProperty("--cad-vvt", `${Math.round(vv.offsetTop)}px`);
    };

    _computeSize = () => {
        const width = viewportWidth();
        const fullscreen = width <= 960;
        const compactStepper = width <= COMPACT_STEPPER_MAX_WIDTH;
        if (this.state._fullscreen !== fullscreen || this.state._compactStepper !== compactStepper) {
            this.setState({_fullscreen: fullscreen, _compactStepper: compactStepper}, () => { this.forceUpdate(); });
        }
    };

    componentWillReceiveProps(new_props) {
        // Refresh the capacity snapshot whenever the dialog (re)opens.
        if (new_props.open && !this.state.open) this._fetchCapacity();
        this.setState(new_props, () => {
            this.forceUpdate();
        });
    }

    _handleUsernameChange = async(e) => {
        let { api } = this.state;
        // Force-lowercase: spec says no capitals, ever.
        let _username = String(e.target.value || "").toLowerCase();
        let valid = await validateUsername(_username);
        let _username_syntax_error = valid === null ? "": valid;
        this.setState({
            _username,
            _username_syntax_error,
            _pending_username_validation: true,
            // Reset recovery mode whenever the username changes — we re-decide
            // after the availability check below.
            _recoveryMode: false,
            _recoveryStatus: "idle",
            // Hide the Advanced section immediately while we're checking — any
            // open state must wait for the debounce below.
            _advancedOpen: false,
        }, () => {
            // Cancel any in-flight debounced open: keystrokes always supersede
            // the last decision.
            if (this._advancedOpenTimer) {
                clearTimeout(this._advancedOpenTimer);
                this._advancedOpenTimer = null;
            }
            this.forceUpdate(async() => {
                if (_username_syntax_error && _username_syntax_error.length) {
                    this.setState({ _pending_username_validation: false, _username_available: false }, () => this.forceUpdate());
                    return;
                }
                const accounts = await api.accounts.getAccounts([_username]);
                const available = Boolean(accounts[0]?.name !== _username);
                const updates = {
                    _pending_username_validation: false,
                    _username_available: available,
                };
                if (available) {
                    // Fresh username — auto-generate an 18-word seed if we don't
                    // already have one (or the previous one was generated for a
                    // different username path). Advanced stays hidden. Wordlist
                    // follows the active UI language (English fallback).
                    if (this.state._seed.length === 0) {
                        try {
                            updates._seed = await generateMnemonic(18, getLanguage());
                        } catch (_) {}
                    }
                    updates._recoveryMode = false;
                    updates._recoveryStatus = "idle";
                    updates._advancedOpen = false;
                } else {
                    // Taken — enter recovery mode, clear any previously-generated
                    // seed. The Advanced (mnemonic + password) panel opens after
                    // a short debounce so it doesn't flicker open/closed during
                    // fast typing.
                    updates._recoveryMode = true;
                    updates._recoveryStatus = "idle";
                    updates._seed = [];
                }
                this.setState(updates, () => {
                    this.forceUpdate(() => {
                        if (!available) {
                            // Schedule the panel to open after the user stops
                            // typing for ~250ms.
                            this._advancedOpenTimer = setTimeout(() => {
                                this._advancedOpenTimer = null;
                                // Re-check the latest state — the user may have
                                // edited the username since the timer was set.
                                if (this.state._recoveryMode && !this.state._username_available) {
                                    this.setState({ _advancedOpen: true }, () => this.forceUpdate());
                                }
                            }, 250);
                        }
                    });
                });
            });
        });
    };

    // Suggestions search the UI language's wordlist; getWordsPossible merges
    // in English matches (all pre-multilanguage seeds are English) and always
    // ranks an exact hit first, so _before_seed_word_add keeps working for
    // legacy seeds on any UI language.
    _set_suggestion = async () => {
        const {_seed_word_input} = this.state;
        if(_seed_word_input.length < 1) {
            this.setState({_seed_word_suggestion: []}, ( )=> {
                this.forceUpdate();
            });
        }else {
            const _seed_word_suggestion = await getWordsPossible(_seed_word_input, getLanguage(), 5)
            this.setState({_seed_word_suggestion}, ( )=> {
                this.forceUpdate();
            });
        }
    }

    _before_seed_word_add = () => {
        const {_seed_word_suggestion, _seed_word_input} = this.state
        const first_seed_word_suggestion = _seed_word_suggestion[0] || "";
        if(first_seed_word_suggestion === _seed_word_input){
            return true;
        }else {
            return false;
        }
    }

    _generate_new_seed = async(entropy) => {
        const counts = {
            128: 12,
            160: 15,
            192: 18,
            224: 21,
            256: 24
        };
        // Wordlist follows the active UI language (English fallback).
        const _seed = await generateMnemonic(counts[entropy] || 18, getLanguage())
        this.setState({_seed}, () => {
            this.forceUpdate();
        });
    };

    /**
     * Derive keys and build the backup PDF blob WITHOUT triggering a download.
     * The blob is held on state and only saved to disk on step 2 success via
     * `_trigger_pdf_download` — that way we don't leak keys to the user's
     * filesystem for accounts that never get created on-chain.
     */
    _generate_keys_silent = async () => {
        const {_username, _seed, _password} = this.state;
        try {
            const masterKey = await generateMasterKey(_seed, _password);
            const [blob, keys] = await generatePDF(_username, _seed, _password, masterKey);

            this.setState({
                _publicKeys:  keys.pub,
                _privateKeys: keys.priv,
                _masterKey:   masterKey,
                _pdfBlob:     blob,
                _downloaded:  true,        // legacy flag — keys exist
                // A new file: none of it has been saved yet.
                _pdfDownloaded: false,
                _pdfVerified:   false,
                _pdfConfirmed:  false,
                _pdfNotice:     "",
                _pdfReminder:   0,
            }, () => this.forceUpdate());
        } catch (err) {
            console.error("[CreateAccountDialog] silent key generation failed:", err);
            if (actions?.trigger_snackbar) {
                actions.trigger_snackbar(t("components.create_account_dialog.could_not_prepare_your_account_keys"), "error");
            }
        }
    };

    /**
     * Save the previously-built PDF blob to disk. Called from the step 2
     * success state via the explicit "Download backup" button; the dialog
     * cannot close before the backup is saved (see _mayClose).
     *
     *  - Where the browser offers a real "Save as" (File System Access API,
     *    Chromium desktop), the file is written through it: a completed write
     *    is a backup KNOWN to be saved, a dismissed picker is known to be
     *    cancelled. showSaveFilePicker is called first thing, inside the
     *    click's user activation.
     *  - Anywhere else, a plain download is all a page can start, and
     *    whether the file was kept or the download cancelled can't be seen:
     *    the person then confirms it (StepConfirm's checkbox).
     */
    _trigger_pdf_download = async () => {
        const { _pdfBlob, _username, _pdfSaving } = this.state;
        if (!_pdfBlob || _pdfSaving) return;
        const filename = `KeysOf-${_username}-Pixagram.pdf`;

        if (typeof window !== "undefined" && typeof window.showSaveFilePicker === "function") {
            let handle = null;
            try {
                handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
                });
            } catch (err) {
                if (err && err.name === "AbortError") {
                    // The picker was dismissed: nothing saved, and we know it.
                    this.setState({ _pdfNotice: "cancelled" }, () => this.forceUpdate());
                    return;
                }
                handle = null; // not usable here (policy, embedded view…): plain download below
            }
            if (handle) {
                this.setState({ _pdfSaving: true, _pdfNotice: "" }, () => this.forceUpdate());
                try {
                    const writable = await handle.createWritable();
                    await writable.write(_pdfBlob);
                    await writable.close();
                    this.setState({
                        _pdfSaving: false,
                        _pdfDownloaded: true,
                        _pdfVerified: true,
                        _pdfConfirmed: true,
                        _pdfNotice: "",
                    }, () => this.forceUpdate());
                } catch (err) {
                    console.error("[CreateAccountDialog] PDF save failed:", err);
                    this.setState({ _pdfSaving: false, _pdfNotice: "failed" }, () => this.forceUpdate());
                }
                return;
            }
        }

        try {
            const url = URL.createObjectURL(_pdfBlob);
            const a = document.createElement("a");
            a.download = filename;
            a.href = url;
            a.click();
            a.remove();
            // Revoked later rather than right after click(): some browsers
            // still read the URL once the save prompt has been answered.
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            // Started — not known to be kept: the person confirms it.
            this.setState({ _pdfDownloaded: true, _pdfNotice: "" }, () => this.forceUpdate());
        } catch (err) {
            console.error("[CreateAccountDialog] PDF download failed:", err);
            this.setState({ _pdfNotice: "failed" }, () => this.forceUpdate());
        }
    };

    /** StepConfirm's "I have saved my backup PDF" checkbox. */
    _handlePdfConfirmedToggle = () => {
        if (this.state._pdfVerified) return; // known saved: nothing to confirm
        this.setState({ _pdfConfirmed: !this.state._pdfConfirmed }, () => this.forceUpdate());
    };

    _handleMouseDownPassword = (event) => {
        event.preventDefault();
    };

    _first_step_done = () => {
        const {
            _seed,
            _username,
            _username_syntax_error,
            _pending_username_validation,
            _username_available,
            _recoveryMode,
            _termsAccepted,
        } = this.state;

        if (!_username.length) return false;
        if (_username_syntax_error && _username_syntax_error.length) return false;
        if (_pending_username_validation) return false;
        // Terms of Use + Privacy Policy must be explicitly accepted before
        // NEXT / RECOVER (the Terms bind the Interface, recovery included).
        if (!_termsAccepted) return false;

        const seed_ok = [12, 15, 18, 21, 24].indexOf(_seed.length) !== -1;

        if (_username_available) {
            // Fresh account — seed should have been auto-generated; require it.
            return seed_ok;
        }
        // Taken account — user must explicitly enter recovery mode (which happens
        // when they click the RECOVER button) and provide a seed.
        return _recoveryMode && seed_ok;
    };

    _second_step_done = () => {
        const { _recoveryMode, _codeStatus, _recoveryStatus, _voucher } = this.state;
        if (_recoveryMode) return _recoveryStatus === "ok";
        // The voucher IS the ticket /create-account redeems — "verified" only
        // counts when we actually hold it.
        return _codeStatus === "ok" && Boolean(_voucher);
    };

    _third_step_done = () => {
        // The CONFIRM step finishes itself (success state); the OK button just
        // closes the dialog. There is no "next" past step 2.
        return this.state._confirmStatus === "success";
    };

    _can_click_next = () => {
        const { _tab_value: v, _creating_account } = this.state;
        if (_creating_account) return false;
        if (v === 0) return this._first_step_done();
        if (v === 1) return this._second_step_done();
        if (v === 2) return this._third_step_done();
        return false;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // New-flow handlers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Manual toggle of the Advanced Configuration panel.
     *
     * The panel is also auto-opened (on a taken username, via a debounce in
     * _handleUsernameChange) and auto-closed (on an available username). The
     * manual toggle overrides whichever state we're currently in.
     *
     * Cancelling any pending auto-open timer here prevents the panel from
     * flipping back after the user just manually collapsed it.
     */
    _handleToggleAdvanced = () => {
        if (this._advancedOpenTimer) {
            clearTimeout(this._advancedOpenTimer);
            this._advancedOpenTimer = null;
        }
        this.setState({ _advancedOpen: !this.state._advancedOpen }, () => this.forceUpdate());
    };

    /**
     * Terms row (step 0), the checkbox — or the plain words of its sentence,
     * through the <label>: ticks or unticks the agreement, nothing else. The
     * documents open only from their underlined names (_handleOpenTerms).
     */
    _handleTermsToggle = (e, checked) => {
        const next = typeof checked === "boolean" ? checked : !this.state._termsAccepted;
        this.setState({ _termsAccepted: next }, () => this.forceUpdate());
    };

    /** "Terms of Use" (tab 0) / "Privacy Policy" (tab 1) in that sentence: open that document. */
    _handleOpenTerms = (tab) => {
        this.setState({ _termsModalOpen: true, _termsTab: tab === 1 ? 1 : 0 }, () => this.forceUpdate());
    };

    _handleTermsModalClose = () => {
        this.setState({ _termsModalOpen: false }, () => this.forceUpdate());
    };

    /** Switch between the Terms of Use and the Privacy Policy tab. */
    _handleTermsTabChange = (e, value) => {
        this.setState({ _termsTab: value }, () => {
            if (this._termsContentEl) this._termsContentEl.scrollTop = 0;
            this.forceUpdate();
        });
    };

    _setTermsContentRef = (el) => {
        this._termsContentEl = el || null;
    };

    /**
     * Country chosen from the picker: switch dial code + mask, keep any
     * subscriber digits already typed, reset the code flow, and re-run the
     * phone pre-check for the new destination.
     *
     * `number` (digits, optional) is a whole phone number the user pasted or
     * typed into the picker's search box — the picker recognised its country
     * and offered it; selecting the row also puts the number into the field.
     */
    _handleCountrySelect = (iso, number) => {
        const prefix = dialCodeFor(iso);
        if (!prefix) return;
        let raw = String(number || this.state._phoneRaw || "").replace(/\D/g, "");
        // A number carrying this country's dial code (a whole number from the
        // search box, or an over-long "33 6 12 34 56 78" held in the field
        // whose country the user now picks) loses the code — but only when it
        // would not fit otherwise, since national numbers can start with the
        // same digits (Kazakh mobiles 7xx under +7).
        const { max } = slotRange(iso);
        if (raw.startsWith(prefix) && max > 0 && raw.length > max) raw = raw.slice(prefix.length);
        raw = stripTrunkZero(raw, iso).slice(0, PHONE_MAX_DIGITS);
        this.setState({
            _country: iso,
            _dialCode: "+" + prefix,
            _phoneRaw: raw,
            _phoneMask: pickSubscriberMask(iso, raw.length) || "",
            _phoneFormatted: formatSubscriber(raw, iso),
            _codeSent: false,
            _confirmationCode: "",
            _codeStatus: "idle",
            _phoneCheck: null,
            _sendError: "",
            _phoneError: "",
        }, () => { this.forceUpdate(); this._schedulePhoneCheck(); });
    };

    /**
     * Triggered by the bottom-bar primary button on step 0.
     *
     * Both branches (fresh / recovery) have the same purpose: advance to step 1.
     * For fresh accounts we generate the keys + PDF blob in the background here
     * — but DO NOT trigger the download yet. The download is offered on step 2
     * success, and the user must download before closing.
     */
    _handleNextFromGenerate = async () => {
        const { _recoveryMode } = this.state;

        if (!this._first_step_done()) return;

        if (!_recoveryMode) {
            // Fresh account: derive keys + build PDF blob, but don't download.
            await this._generate_keys_silent();
        }
        this._goToTab(1);
    };

    _goToTab = (value) => {
        this.setState({ _tab_value: parseInt(value, 10) }, () => {
            this.forceUpdate(() => {
                try { this.swipeableViewScrollTop(); } catch (_) {}
            });
        });
    };

    // ── Phone & code handlers ───────────────────────────────────────────────

    // Editing the "+41" dial-code adornment: parse, find the matching country,
    // and re-mask the subscriber field. We always allow the leading "+" to stay
    // even if the user has only typed it, so the field never looks empty.
    _handleDialCodeChange = (e) => {
        const raw = String(e.target.value || "");
        // Keep only "+" and digits; force a leading "+".
        let cleaned = raw.replace(/[^\d+]/g, "");
        if (!cleaned.startsWith("+")) cleaned = "+" + cleaned.replace(/\+/g, "");
        cleaned = "+" + cleaned.slice(1).replace(/\+/g, ""); // strip extra +'s
        const digits = cleaned.replace(/\D/g, "");
        const match = matchCountryByPrefix(digits);
        const updates = {
            _dialCode: cleaned,
            _codeSent: false,
            _confirmationCode: "",
            _codeStatus: "idle",
            _phoneCheck: null,
            _sendError: "",
            _phoneError: "",
        };
        if (match) {
            // Country resolved — switch mask, keep any subscriber digits we had.
            updates._country = match.country;
            updates._phoneMask = pickSubscriberMask(match.country, this.state._phoneRaw.length) || "";
            updates._phoneFormatted = formatSubscriber(this.state._phoneRaw, match.country);
        }
        this.setState(updates, () => { this.forceUpdate(); this._schedulePhoneCheck(); });
    };

    /**
     * Subscriber field change handler.
     *
     *  - Strip non-digits so paste with whitespace (e.g. "79 123 45 67") works.
     *  - If the pasted/typed value is a full international number ("+33 6…",
     *    "0033 6…", "(+33) 6…", a Contacts copy with invisible bidi marks —
     *    see `parsePhoneInput`), select that country: re-route the country
     *    code to `_dialCode` and keep only the subscriber part in the field.
     *  - Without a "+", the current country is kept as long as the number
     *    fits it. A number that does NOT fit and reads as a complete number
     *    of another country — that country's dial code followed by a number
     *    of one of its lengths — selects that country instead ("33 6 12 34
     *    56 78" in a Swiss field is a French mobile, not eleven Swiss digits).
     *    This works while typing too: the digits are shown in full, and the
     *    switch happens the moment the foreign number is complete.
     *  - If the user typed the bare country dial code at the start (e.g. "41..."
     *    in CH), strip it.
     *  - Strip the leading "0" — the European/Swiss/etc. trunk prefix that
     *    callers use domestically but is dropped in the international
     *    representation. So "076 429 49 80" -> "76 429 49 80". (Not in the
     *    plans where the 0 is part of the number: see KEEP_TRUNK_ZERO.)
     *  - Nothing is ever cut off: a number longer than the country's masks is
     *    shown unformatted and flagged under the field (the worker and the
     *    SMS provider remain the authority on what is deliverable).
     *  - When the formatted value would be LONGER than the user's current
     *    input, the user just deleted a separator — pop a digit so the field
     *    never feels "stuck" on the same character.
     */
    _handlePhoneChange = (e, opts) => {
        const inputVal = String(e.target.value || "");
        const { _country, _dialCode } = this.state;
        const parsed = parsePhoneInput(inputVal);
        const prevDigits = String(this.state._phoneRaw || "");
        const resetFlow = { _codeSent: false, _confirmationCode: "", _codeStatus: "idle", _phoneCheck: null, _sendError: "", _phoneError: "" };
        const afterUpdate = () => { this.forceUpdate(); this._schedulePhoneCheck(); };
        // Select `country` (dial code `prefix`, digits only) with `subscriber`
        // in the field.
        const selectCountry = (country, prefix, subscriber) => {
            subscriber = stripTrunkZero(subscriber, country).slice(0, PHONE_MAX_DIGITS);
            this.setState({
                _country: country,
                _dialCode: "+" + prefix,
                _phoneRaw: subscriber,
                _phoneFormatted: formatSubscriber(subscriber, country),
                _phoneMask: pickSubscriberMask(country, subscriber.length) || "",
                ...resetFlow,
            }, afterUpdate);
        };

        // Full international number (paste, autofill or manual "+…" entry):
        // the country code selects the country.
        if (parsed.intl) {
            const match = matchCountryByPrefix(parsed.digits);
            if (match) {
                // "+41 (0)79 …": the trunk 0 goes (stripTrunkZero, in selectCountry).
                selectCountry(match.country, match.prefix, parsed.digits.slice(match.prefix.length));
                return;
            }
            // No country (yet): keep the "+…" visible so the user can go on
            // typing ("+3" on its way to "+33") or see what they pasted
            // ("+999 …"). Nothing is sendable in this state — `_phoneRaw` is
            // empty — and StepVerify explains an unknown code under the field.
            this.setState({ _phoneRaw: "", _phoneFormatted: "+" + parsed.digits, ...resetFlow }, afterUpdate);
            return;
        }

        let digits = stripTrunkZero(parsed.digits, _country).slice(0, PHONE_MAX_DIGITS);
        const { max: maxSlots } = slotRange(_country);

        // Tolerate users typing the country code without "+": if digits start
        // with the current country's dial code AND would not fit the mask
        // otherwise, assume they retyped the prefix and strip it. The overflow
        // condition matters — national numbers can legitimately start with
        // the dial-code digits (Kazakh mobiles 7xx under +7, Lucerne 41x
        // under +41).
        const dialDigits = (_dialCode || "").replace(/\D/g, "");
        if (dialDigits && digits.startsWith(dialDigits) && maxSlots > 0 && digits.length > maxSlots) {
            digits = stripTrunkZero(digits.slice(dialDigits.length), _country);
        }

        // No "+", and the number does not fit the selected country. If it
        // reads as a COMPLETE number of another country — that country's
        // dial code followed by a number of one of its lengths — select that
        // country. Typed digit by digit, "33 6 12 34 56 78" in a Swiss field
        // is shown in full from the 10th digit on (flagged as too long for
        // Switzerland) and becomes a French mobile at the 11th.
        //
        // Guard against stray digits: for the one-digit codes +1 and +7 this
        // switch only happens for a number that arrived in one go (paste,
        // autofill, keyboard clipboard chip) — otherwise a Swiss mobile (7x…)
        // with two extra keystrokes would turn into a Russian number, and a
        // British 1xx… landline with one into an American one.
        if (maxSlots > 0 && digits.length > maxSlots) {
            const match = matchCountryByPrefix(digits);
            if (match && match.country !== _country) {
                const subscriber = stripTrunkZero(digits.slice(match.prefix.length), match.country);
                const range = slotRange(match.country);
                const complete = subscriber.length >= range.min && subscriber.length <= range.max;
                const bulk = Boolean(opts && opts.pasted) || digits.length >= prevDigits.length + 2;
                if (complete && (bulk || match.prefix.length > 1)) {
                    selectCountry(match.country, match.prefix, subscriber);
                    return;
                }
            }
        }

        // Separator-deletion detection: if the user kept the same number of
        // digits but shortened the field, they deleted a separator character
        // — pop a trailing digit so progress visibly happens.
        const prevFormatted = String(this.state._phoneFormatted || "");
        const sameDigits = digits === prevDigits;
        const shortened = inputVal.length < prevFormatted.length;
        if (sameDigits && shortened && digits.length > 0) {
            digits = digits.slice(0, -1);
        }

        const formatted = formatSubscriber(digits, _country);

        this.setState({
            _phoneRaw: digits,
            _phoneFormatted: formatted,
            _phoneMask: pickSubscriberMask(_country, digits.length) || "",
            ...resetFlow,
        }, afterUpdate);
    };

    /**
     * Paste handler — explicit so the clipboard text is parsed on its own
     * (`parsePhoneInput` handles the "+", "00", bidi-mark and "tel:" cases),
     * regardless of what the field already contains or where the caret is.
     * We intercept the paste, normalise, and apply it; the synthetic onChange
     * would otherwise fire with the clipboard text spliced into the current
     * value.
     */
    _handlePhonePaste = (e) => {
        try {
            const txt = (e.clipboardData || window.clipboardData)?.getData("text") || "";
            if (!txt) return;
            e.preventDefault();
            this._handlePhoneChange({ target: { value: txt.trim() } }, { pasted: true });
        } catch (_) {
            // Fall through — let the default paste happen and onChange catch it.
        }
    };

    // Takes the bare code from the code boxes ("ABC12") — or an input event.
    _handleCodeChange = (e) => {
        const formatted = formatConfirmationCode(typeof e === "string" ? e : e && e.target ? e.target.value : "");
        const cleaned = String(formatted || "").replace(/-/g, "");
        const prevStatus = this.state._codeStatus;
        // Editing the code clears any previous fail/ok state.
        const _codeStatus = (prevStatus === "ok" || prevStatus === "fail") ? "idle" : prevStatus;

        this.setState({
            _confirmationCode: formatted,
            _codeStatus,
        }, () => {
            this.forceUpdate(() => {
                // Auto-verify the moment the code is fully typed (6 digits).
                // Skip if a verification is already in flight.
                if (cleaned.length === 6 && this.state._codeStatus !== "pending") {
                    this._verifyCode();
                }
            });
        });
    };

    // ── Unified account-service calls ────────────────────────────────────────

    /**
     * Snapshot of the daily creation budget (GET /capacity). Non-blocking and
     * cosmetic: a failed read leaves _capacity null and the flow proceeds —
     * the worker stays the authority and answers 429 if the pool is empty.
     */
    _fetchCapacity = async () => {
        try {
            const res = await fetch(`${ACCOUNT_SERVICE_API}/capacity`);
            const json = await res.json();
            if (json && json.success) {
                this.setState({ _capacity: json }, () => this.forceUpdate());
            }
        } catch (_) { /* ignore — capacity display is cosmetic */ }
    };

    /** Drive the resend-button countdown (server cooldown mirror). */
    _startResendCountdown = (seconds) => {
        if (this._resendTimer) { clearInterval(this._resendTimer); this._resendTimer = null; }
        const total = Math.max(0, Math.round(seconds || 0));
        this.setState({ _resendInSec: total }, () => this.forceUpdate());
        if (total <= 0) return;
        this._resendTimer = setInterval(() => {
            const next = (this.state._resendInSec || 0) - 1;
            if (next <= 0 && this._resendTimer) { clearInterval(this._resendTimer); this._resendTimer = null; }
            this.setState({ _resendInSec: next > 0 ? next : 0 }, () => this.forceUpdate());
        }, 1000);
    };

    /**
     * Debounced pre-flight: schedule a /check-phone for the currently typed
     * number. Runs while the user types, so a consumed / limit-reached /
     * cooling-down phone is flagged BEFORE any SMS is requested.
     */
    _schedulePhoneCheck = () => {
        if (this._phoneCheckTimer) { clearTimeout(this._phoneCheckTimer); this._phoneCheckTimer = null; }
        const { _phoneRaw } = this.state;
        if (String(_phoneRaw || "").length < 4) return;
        this._phoneCheckTimer = setTimeout(() => {
            this._phoneCheckTimer = null;
            this._checkPhone();
        }, PHONE_CHECK_DEBOUNCE_MS);
    };

    /**
     * POST /check-phone — asks the worker whether this number can receive a
     * verification SMS right now, without sending one. Best-effort: a failed
     * check leaves _phoneCheck null and the server stays the authority at
     * send time. Unsupported destinations are decided locally, request-free.
     */
    _checkPhone = async () => {
        const { _phoneRaw, _dialCode } = this.state;
        if (destSupport(_dialCode) === "unsupported") {
            this.setState({ _phoneChecking: false, _phoneCheck: null }, () => this.forceUpdate());
            return;
        }
        const phone = composeE164(_dialCode, _phoneRaw);
        this.setState({ _phoneChecking: true }, () => this.forceUpdate());
        try {
            const res = await fetch(`${ACCOUNT_SERVICE_API}/check-phone`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ phone }),
            });
            const json = await res.json().catch(() => ({}));
            // Stale-response guard: the user may have kept typing.
            const nowPhone = composeE164(this.state._dialCode, this.state._phoneRaw);
            if (nowPhone !== phone) { this.setState({ _phoneChecking: false }, () => this.forceUpdate()); return; }

            if (res.ok && json.success) {
                const updates = {
                    _phoneChecking: false,
                    _phoneCheck: json,
                    _nextSendAllowedAt: json.next_send_allowed_at || null,
                };
                // Verified phone + voucher already in hand (back-and-forth
                // navigation): mark the step green without any SMS.
                if (json.phone_status === "verified" && this.state._voucher) {
                    updates._codeStatus = "ok";
                    updates._codeSent = true;
                }
                this.setState(updates, () => this.forceUpdate());
            } else {
                this.setState({ _phoneChecking: false, _phoneCheck: null }, () => this.forceUpdate());
            }
        } catch (_) {
            this.setState({ _phoneChecking: false, _phoneCheck: null }, () => this.forceUpdate());
        }
    };

    /**
     * POST /send-code on the unified worker.
     *
     * The worker answers with more than ok/fail — the cases that matter here:
     *   - 200 + already_confirmed: the phone holds a live voucher. If this
     *     session has it (back-and-forth navigation), skip straight to
     *     verified; the token is never re-revealed, so a *different* session
     *     must finish where it verified or wait for the voucher to expire.
     *   - 403: the phone already created an account (permanent, one per phone).
     *   - 403 TURNSTILE_*: the bot gate refused the (missing / stale) token.
     *   - 429 + retry_after: resend cooldown — mirrored on the button.
     *   - 429 VELOCITY_LIMIT / RATE_LIMITED, 503 SENDING_DISABLED: the
     *     worker's anti-pumping ceilings, burst limiter and kill switch.
     *
     * `turnstileToken` comes from StepVerify's handleSendClick (null when the
     * gate is off or the challenge did not complete in time).
     */
    _sendCode = async (turnstileToken) => {
        const { _phoneRaw, _dialCode } = this.state;
        const phone = composeE164(_dialCode, _phoneRaw);
        const payload = { phone, language: toSmsLang(getLanguage()) };
        if (typeof turnstileToken === "string" && turnstileToken) payload.turnstile_token = turnstileToken;
        this.setState({ _sendingCode: true, _codeStatus: "idle", _sendError: "", _phoneError: "", _codeError: "" }, () => this.forceUpdate());
        try {
            const res = await fetch(`${ACCOUNT_SERVICE_API}/send-code`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify(payload),
            });
            const json = await res.json().catch(() => ({}));

            if (res.ok && json.success && json.already_confirmed) {
                if (this.state._voucher) {
                    // We hold the live voucher — nothing to redo.
                    this.setState({
                        _sendingCode: false, _codeSent: true, _codeStatus: "ok", _sendError: "",
                    }, () => this.forceUpdate());
                } else {
                    this.setState({
                        _sendingCode: false,
                        _sendError: t("components.create_account_dialog.this_phone_is_already_verified_finish_sign"),
                    }, () => this.forceUpdate());
                }
                return;
            }

            if (res.ok && json.success) {
                // One SMS per window: the resend button stays locked until the
                // server-announced next_send_allowed_at, not a local countdown.
                this.setState({
                    _codeSent: true, _sendingCode: false, _confirmationCode: "", _sendError: "",
                    _nextSendAllowedAt: json.next_send_allowed_at || null,
                    _phoneCheck: null,
                }, () => this.forceUpdate());
                return;
            }

            let msg = json.error || t("components.create_account_dialog.could_not_send_the_confirmation_code_try");
            if (json.code === "SEND_WINDOW") {
                // 1 SMS per 7-day window: a ticking countdown makes no sense
                // at this scale — show the date and lock the button until then.
                const when = json.next_send_allowed_at
                    ? new Date(json.next_send_allowed_at).toLocaleString(getLocaleCode())
                    : null;
                msg = when
                    ? t("components.create_account_dialog.an_sms_was_already_sent_to_this_number_the", { date: when })
                    : (workerText(json.error) || t("components.create_account_dialog.an_sms_was_already_sent_to_this_number"));
                this.setState({ _nextSendAllowedAt: json.next_send_allowed_at || null }, () => this.forceUpdate());
                if (typeof json.retry_after === "number" && json.retry_after <= 300) {
                    this._startResendCountdown(json.retry_after);
                }
            } else if (json.code === "COUNTRY_NOT_SUPPORTED" || json.code === "COUNTRY_NOT_ENABLED" || json.code === "SENDER_NOT_AVAILABLE") {
                msg = workerText(json.error) || t("components.create_account_dialog.sms_verification_is_not_yet_available_for");
            } else if (json.code === "IP_LIMIT") {
                msg = workerText(json.error) || t("components.create_account_dialog.too_many_verification_requests_from_your");
                if (typeof json.retry_after === "number" && json.retry_after <= 300) {
                    this._startResendCountdown(json.retry_after);
                }
            } else if (json.code === "SEND_LIMIT_TOTAL") {
                msg = t("components.create_account_dialog.this_phone_number_has_reached_the_maximum", { max: json.sends_max_total || 2 });
            } else if (json.code === "TURNSTILE_REQUIRED" || json.code === "TURNSTILE_FAILED") {
                // The gate is on and the token was missing, stale or already
                // used. The widget is reset before every send, so a plain
                // retry usually succeeds; a blocked script needs a reload.
                msg = TURNSTILE_SITE_KEY
                    ? t("components.create_account_dialog.the_browser_check_did_not_pass_please_try")
                    : t("components.create_account_dialog.this_version_of_the_app_cannot_pass_the");
            } else if (json.code === "TURNSTILE_UNAVAILABLE") {
                msg = t("components.create_account_dialog.the_browser_check_service_is_momentarily");
                this._startResendCountdown(30);
            } else if (json.code === "VELOCITY_LIMIT" || json.code === "RATE_LIMITED") {
                // Anti-pumping ceiling or burst limiter. retry_after can be up
                // to a day for a daily ceiling: show a date beyond 5 minutes,
                // a countdown below.
                const when = json.next_send_allowed_at
                    ? new Date(json.next_send_allowed_at).toLocaleString(getLocaleCode())
                    : null;
                if (typeof json.retry_after === "number" && json.retry_after <= 300) {
                    this._startResendCountdown(json.retry_after);
                    msg = workerText(json.error) || t("components.create_account_dialog.too_many_verification_requests_right_now");
                } else {
                    msg = when
                        ? t("components.create_account_dialog.too_many_verification_requests_right_now_2", { date: when })
                        : (workerText(json.error) || t("components.create_account_dialog.too_many_verification_requests_right_now_3"));
                }
            } else if (json.code === "SENDING_DISABLED") {
                msg = workerText(json.error) || t("components.create_account_dialog.sms_verification_is_temporarily_paused");
            } else if (res.status === 429 && json.retry_after) {
                this._startResendCountdown(json.retry_after);
                msg = t(
                    "components.create_account_dialog.please_wait_s_before_requesting_another_code",
                    {
                        retry_after: json.retry_after
                    }
                );
            } else if (res.status === 403) {
                // The number itself is refused (one account per phone): said
                // under the phone field, like /check-phone's verdict, and
                // SEND stays off until the number changes.
                msg = workerText(json.error) || t("components.create_account_dialog.this_phone_number_has_already_been_used");
                this.setState({ _sendingCode: false, _phoneError: msg }, () => this.forceUpdate());
                if (actions?.trigger_snackbar) actions.trigger_snackbar(msg, "error");
                return;
            } else if (res.status === 400) {
                msg = workerText(json.error) || t("components.create_account_dialog.that_phone_number_doesnt_look_valid");
            }
            this.setState({ _sendingCode: false, _sendError: msg }, () => this.forceUpdate());
            if (actions?.trigger_snackbar) actions.trigger_snackbar(msg, "error");
        } catch (err) {
            this.setState({ _sendingCode: false, _sendError: t("components.create_account_dialog.network_error_could_not_reach_the_account") }, () => this.forceUpdate());
            if (actions?.trigger_snackbar) {
                actions.trigger_snackbar(t(
                    "components.create_account_dialog.could_not_send_the_confirmation_code_try"
                ), "error");
            }
        }
    };

    /**
     * POST /verify-code — on success the worker issues the account-creation
     * voucher, revealed exactly once. It is held in state and injected into
     * /create-account at the confirm step.
     */
    _verifyCode = async () => {
        const { _phoneRaw, _dialCode, _confirmationCode } = this.state;
        const code = String(_confirmationCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (code.length < 6) return;
        const phone = composeE164(_dialCode, _phoneRaw);
        this.setState({ _codeStatus: "pending", _codeError: "" }, () => this.forceUpdate());
        try {
            const res = await fetch(`${ACCOUNT_SERVICE_API}/verify-code`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ phone, code }),
            });
            const json = await res.json().catch(() => ({}));

            if (res.ok && json.success && json.voucher) {
                this.setState({
                    _codeStatus:       "ok",
                    _voucher:          json.voucher,
                    _voucherExpiresAt: json.voucher_expires_at || null,
                    _codeError:        "",
                }, () => this.forceUpdate());
                return;
            }

            // 409: phone already verified. Holding the voucher makes that a
            // pass (back-and-forth navigation); without it, this session is
            // stuck until the original voucher expires.
            if (res.status === 409 && this.state._voucher) {
                this.setState({ _codeStatus: "ok", _codeError: "" }, () => this.forceUpdate());
                return;
            }

            let msg = workerText(json.error) || t("components.create_account_dialog.that_code_doesnt_match_double_check_the_sms");
            if (res.status === 401 && typeof json.attempts_remaining === "number") {
                msg = t(
                    "components.create_account_dialog.that_code_doesnt_match_attempt_left_before",
                    {
                        attempt: { attempt: json.attempts_remaining },
                    }
                );
            } else if (res.status === 410) {
                msg = t("components.create_account_dialog.that_code_expired_send_a_new_one");
            } else if (res.status === 429) {
                msg = workerText(json.error) || t("components.create_account_dialog.too_many_attempts_request_a_new_code");
            } else if (res.status === 409) {
                msg = t("components.create_account_dialog.this_phone_is_already_verified_from_another");
            } else if (res.status === 403) {
                msg = workerText(json.error) || t("components.create_account_dialog.this_phone_number_has_already_been_used");
            } else if (res.status === 404) {
                msg = t("components.create_account_dialog.no_verification_in_progress_for_this_number");
            } else if (res.status === 500) {
                msg = t("components.create_account_dialog.verification_hiccuped_on_the_server_send_a");
            }
            this.setState({ _codeStatus: "fail", _codeError: msg }, () => this.forceUpdate());
        } catch (err) {
            this.setState({ _codeStatus: "fail", _codeError: t("components.create_account_dialog.network_error_could_not_reach_the_account") }, () => this.forceUpdate());
        }
    };

    // ── Recovery: derive keys from entered seed, compare to chain ───────────
    _verifyRecovery = async () => {
        const { _username, _seed, _password, api } = this.state;
        this.setState({ _recoveryStatus: "pending" }, () => this.forceUpdate());
        try {
            const masterKey = await generateMasterKey(_seed, _password);
            // generatePDF returns [blob, keys] — keep both so the user can
            // download a refreshed backup at step 2 success.
            const [blob, keys] = await generatePDF(_username, _seed, _password, masterKey);
            const derived = keys.pub || {};

            // Fetch the on-chain account and compare each role key.
            const accounts = await api.accounts.getAccounts([_username]);
            const onChain = accounts && accounts[0];
            if (!onChain) {
                this.setState({ _recoveryStatus: "fail" }, () => this.forceUpdate());
                return;
            }

            // HIVE/STEEM accounts: owner/active/posting are { key_auths: [[key, weight], ...] }
            // memo_key is a flat string.
            const firstKeyAuth = (obj) => Array.isArray(obj?.key_auths) && obj.key_auths[0] ? obj.key_auths[0][0] : null;
            const chainKeys = {
                owner:   firstKeyAuth(onChain.owner),
                active:  firstKeyAuth(onChain.active),
                posting: firstKeyAuth(onChain.posting),
                memo:    onChain.memo_key || null,
            };

            const match =
                chainKeys.owner   && chainKeys.owner   === derived.owner   &&
                chainKeys.active  && chainKeys.active  === derived.active  &&
                chainKeys.posting && chainKeys.posting === derived.posting &&
                chainKeys.memo    && chainKeys.memo    === derived.memo;

            if (match) {
                this.setState({
                    _recoveryStatus: "ok",
                    _publicKeys:     derived,
                    _privateKeys:    keys.priv,
                    _masterKey:      masterKey,
                    _pdfBlob:        blob,
                    // A new file: none of it has been saved yet.
                    _pdfDownloaded:  false,
                    _pdfVerified:    false,
                    _pdfConfirmed:   false,
                    _pdfNotice:      "",
                    _pdfReminder:    0,
                }, () => this.forceUpdate());
            } else {
                this.setState({ _recoveryStatus: "fail" }, () => this.forceUpdate());
            }
        } catch (err) {
            this.setState({ _recoveryStatus: "fail" }, () => this.forceUpdate());
        }
    };

    // ── Sign-in after creation/recovery ─────────────────────────────────────
    //
    // The steps LoginDialog takes for a master password without a PIN
    // (_executeLogin, its path 2), so the person ends up logged in exactly as
    // if they had typed their master password there. What each step does is
    // read off utils/api/pixaproxyapi.js:
    //
    //   1. api.updateConfig({ SESSION_TIMEOUT, PIN_TIMEOUT }) — the 1-day
    //      window the session is created with.
    //   2. api.validateCredentials(username, masterKey, 'master') — derives
    //      the role keys and checks them against the account ON CHAIN. While
    //      the node doesn't show a just-created account yet it answers
    //      { valid: false, error: 'Account not found' }, so a refusal is asked
    //      again for up to ACCOUNT_VISIBLE_TIMEOUT_MS — except keys that don't
    //      match (PERMANENT_VALIDATION_ERRORS), which waiting can't change.
    //   3. api.quickLogin(..., { validation, skipSession: false,
    //      stayConnected: true }) — handed that validation, it doesn't check
    //      again: it caches the keys, creates the persistent session (with
    //      its session_created event) and makes the account the active one.
    //      Not handed one, quickLogin validates by itself: the
    //      `skipValidation` the previous version passed has been ignored
    //      since the API's v3.5.2. So it checked the brand-new account once,
    //      the moment it was created, got 'Account not found' — and the
    //      "You're signed in" text hid the failure.
    //   4. No session id back: session_created is emitted by hand, as
    //      LoginDialog does — the keys are cached and the account active.
    //
    // Resolves { ok, error }: a failure is reported, never covered by a
    // "You're signed in". Registration runs it when the finished dialog
    // closes (_signInAndClose) — by then the account is on chain — and
    // recovery at its confirm step (the account has long been there).
    _loginCurrentAccount = async () => {
        const { api, _username, _masterKey } = this.state;
        const { onLogin } = this.props;

        if (!api || typeof api.validateCredentials !== "function" ||
            typeof api.quickLogin !== "function" || !_masterKey) {
            console.error("[CreateAccountDialog] sign-in: missing api or master key");
            return { ok: false, error: t("components.create_account_dialog.the_connection_to_the_blockchain_isnt_ready") };
        }

        const sessionTimeoutMs = SESSION_TIMEOUT_MIN * 60 * 1000;
        const pinTimeoutMs     = PIN_TIMEOUT_MIN     * 60 * 1000;
        const userAgent        = (typeof navigator !== "undefined" && navigator.userAgent) || "unknown";

        try {
            // Step 1: align session manager config with the desired 1-day window.
            if (typeof api.updateConfig === "function") {
                try {
                    api.updateConfig({
                        SESSION_TIMEOUT: sessionTimeoutMs,
                        PIN_TIMEOUT:     pinTimeoutMs,
                    });
                } catch (e) {
                    console.warn("[CreateAccountDialog] api.updateConfig failed (non-fatal):", e);
                }
            }

            // Step 2: the credentials, checked on chain — with time for a
            // brand-new account to become visible on the node.
            const deadline = Date.now() + ACCOUNT_VISIBLE_TIMEOUT_MS;
            let validation = null;
            for (;;) {
                try {
                    validation = await api.validateCredentials(_username, _masterKey, "master");
                } catch (e) {
                    validation = { valid: false, error: (e && e.message) || "" };
                }
                if (validation && validation.valid) break;
                if (this._unmounted) return { ok: false, error: "" };
                const refusal = (validation && validation.error) || "";
                if (PERMANENT_VALIDATION_ERRORS.includes(refusal) ||
                    Date.now() + ACCOUNT_VISIBLE_RETRY_MS > deadline) {
                    throw new Error(refusal || t("components.create_account_dialog.your_new_account_could_not_be_verified_on"));
                }
                await new Promise((resolve) => setTimeout(resolve, ACCOUNT_VISIBLE_RETRY_MS));
            }

            // Step 3: quickLogin from that validation — LoginDialog's call.
            const result = await api.quickLogin(_username, _masterKey, "master", {
                validation,
                skipSession:   false,
                stayConnected: true,
                userAgent,
            });

            // Step 4: no session id — at least let the UI know, as LoginDialog.
            if (!(result && (result.sessionId || result.eventEmitted)) && api.eventEmitter?.emit) {
                api.eventEmitter.emit("session_created", { account: _username });
            }

            // Offer the browser the master password for "save password?"
            // prompt — same single-credential pattern LoginDialog autofills against.
            this._triggerCredentialSave(_username, _masterKey);

            if (typeof onLogin === "function") {
                onLogin({ username: _username, autoFromCreation: true });
            }
            return { ok: true, error: "" };
        } catch (err) {
            console.error("[CreateAccountDialog] sign-in failed:", err);
            return { ok: false, error: (err && err.message) || "" };
        }
    };

    /**
     * The finished sign-up is closing (OK, Escape, a backdrop click, the back
     * arrow — see _mayClose): sign the new account in first, then close. A
     * failure keeps the dialog open with the reason, TRY AGAIN and CLOSE
     * (which leaves without signing in — the backup PDF logs in any time).
     */
    _signInAndClose = async () => {
        if (this._signingIn) return;
        this._signingIn = true;
        this.setState({ _signInState: "pending", _signInError: "" }, () => this.forceUpdate());
        const { ok, error } = await this._loginCurrentAccount();
        this._signingIn = false;
        if (this._unmounted) return;
        if (ok) {
            this.setState({ _signInState: "done" }, () => {
                this.forceUpdate();
                this._handleDialogClose();
            });
        } else {
            this.setState({ _signInState: "failed", _signInError: error || "" }, () => this.forceUpdate());
        }
    };

    // CLOSE after a failed sign-in: leave without signing in.
    _handleCloseSignedOut = () => {
        this._leaveSignedOut = true;
        this._handleDialogClose();
    };

    // (The success screen no longer closes by itself: see _mayClose.)

    // ─────────────────────────────────────────────────────────────────────────
    // Browser Credential Save — offers to save keys for LoginDialog autofill
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Trigger the browser's "Save password?" prompt for the newly created account.
     *
     * Saves a SINGLE credential: id=username, password=masterKey. The master
     * password derives every key (posting, active, owner, memo) on demand, so
     * one credential is all the browser ever needs to remember. When LoginDialog
     * autofills, it gets the master password automatically and derives the rest.
     *
     * @param {string} username
     * @param {string} masterKey — the master password (derives all keys)
     * @private
     */
    _triggerCredentialSave = (username, masterKey) => {
        if (!masterKey) return;

        // Path 1: Credential Management API (Chromium 51+)
        if (typeof window !== 'undefined' && window.PasswordCredential) {
            try {
                const cred = new window.PasswordCredential({
                    id:       username,
                    password: masterKey,
                    name:     `@${username}`,
                });
                navigator.credentials.store(cred).catch(() => {});
                return;
            } catch (_) {}
        }

        // Path 2: Hidden form submission (Firefox, Safari)
        const form = this._credentialFormRef?.current;
        if (form) {
            try {
                const uInput = form.querySelector('input[name="username"]');
                const pInput = form.querySelector('input[name="password"]');
                if (uInput) uInput.value = username;
                if (pInput) pInput.value = masterKey;
                if (form.requestSubmit) {
                    form.requestSubmit();
                }
            } catch (_) {}
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Account Creation via Cloudflare Worker
    // ─────────────────────────────────────────────────────────────────────────
    _createAccountOnChain = async () => {
        const { _username, _publicKeys, _voucher } = this.state;

        if (!_publicKeys.owner || !_publicKeys.active || !_publicKeys.posting || !_publicKeys.memo) {
            const errorMsg = t("components.create_account_dialog.public_keys_not_found_please_download_the");
            this.setState({ _confirmStatus: "error", _errorMessage: errorMsg }, () => this.forceUpdate());
            if (actions?.trigger_snackbar) actions.trigger_snackbar(errorMsg, "error");
            return;
        }

        if (!_voucher) {
            const errorMsg = t("components.create_account_dialog.phone_verification_voucher_missing_go_back");
            this.setState({ _confirmStatus: "error", _errorMessage: errorMsg }, () => this.forceUpdate());
            if (actions?.trigger_snackbar) actions.trigger_snackbar(errorMsg, "error");
            return;
        }

        this.setState({ _creating_account: true, _confirmStatus: "working" }, () => this.forceUpdate());

        try {
            const requestBody = {
                voucher:      _voucher,
                account_name: _username.toLowerCase(),
                owner_key:    _publicKeys.owner,
                active_key:   _publicKeys.active,
                posting_key:  _publicKeys.posting,
                memo_key:     _publicKeys.memo,
            };

            const response = await fetch(`${ACCOUNT_SERVICE_API}/create-account`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify(requestBody),
            });

            const result = await response.json();

            if (result.success) {
                // Not signed in here: the node may not show the account for a
                // few seconds yet. The person saves the backup PDF first, and
                // closing the dialog signs them in (_signInAndClose).
                //
                // No auto-close: the dialog stays until the person has saved
                // the backup PDF and closes it themselves (_mayClose).
                this.setState({
                    _creating_account: false,
                    _confirmStatus:    "success",
                }, () => this.forceUpdate());

                if (actions?.trigger_snackbar) {
                    actions.trigger_snackbar(t("components.create_account_dialog.account_created_successfully", {
                        account_name: result.account_name
                    }), "success");
                }
                if (this.props.onAccountCreated) {
                    this.props.onAccountCreated({
                        account_name:   result.account_name,
                        transaction_id: result.transaction_id,
                        block_num:      result.block_num,
                    });
                }
            } else {
                // Map worker states to actionable messages. Which errors leave
                // the voucher reusable decides what we tell the user to do:
                //   402 / 500 / name-taken 409 → voucher released, retry OK
                //   429 capacity              → voucher untouched, retry later
                //   410 / voucher 403|409     → verification terminal, redo it
                const status = response.status;
                let errorMsg = t("components.create_account_dialog.account_creation_failed", {
                    error: result.error || t("components.create_account_dialog.unknown_error")
                });
                if (status === 410 || (status === 403 && result.field === "voucher")) {
                    errorMsg = t("components.create_account_dialog.your_phone_verification_expired_go_back_and");
                    this.setState({
                        _voucher: null, _voucherExpiresAt: null,
                        _codeStatus: "idle", _codeSent: false, _confirmationCode: "",
                    }, () => this.forceUpdate());
                } else if (status === 409 && result.field === "voucher") {
                    errorMsg = result.used_at
                        ? t("components.create_account_dialog.this_phone_verification_was_already_used_to")
                        : t("components.create_account_dialog.an_account_creation_with_this_verification_is");
                } else if (status === 409) {
                    errorMsg = t("components.create_account_dialog.was_just_taken_on_chain_go_back_and_pick", { username: _username.toLowerCase() });
                } else if (status === 429) {
                    const when = result.next_refill_at ? new Date(result.next_refill_at).toLocaleString(getLocaleCode()) : t("components.create_account_dialog.the_next_utc_midnight");
                    errorMsg = t("components.create_account_dialog.account_creation_capacity_is_exhausted_for", { date: when });
                    this._fetchCapacity();
                } else if (status === 402 || status === 500 || status === 503) {
                    errorMsg = t("components.create_account_dialog.error_your_phone_verification_is_still_valid", { error: result.error || t("components.create_account_dialog.the_network_broadcast_failed") });
                }
                this.setState({ _creating_account: false, _confirmStatus: "error", _errorMessage: errorMsg }, () => this.forceUpdate());
                if (actions?.trigger_snackbar) actions.trigger_snackbar(errorMsg, "error");
            }
        } catch (error) {
            const errorMsg = t("components.create_account_dialog.account_creation_failed_2", {
                message: error.message || t("components.create_account_dialog.unknown_error")
            });
            this.setState({ _creating_account: false, _confirmStatus: "error", _errorMessage: errorMsg }, () => this.forceUpdate());
            if (actions?.trigger_snackbar) actions.trigger_snackbar(errorMsg, "error");
        }
    };

    /**
     * Recovery counterpart: no on-chain account creation; just auto-login using
     * the keys we derived from the user-supplied seed during _verifyRecovery.
     */
    _recoverAndLogin = async () => {
        this.setState({ _confirmStatus: "working" }, () => this.forceUpdate());
        const { ok } = await this._loginCurrentAccount();
        if (this._unmounted) return;
        if (ok) {
            // Signed in already: closing has nothing left to do.
            this.setState({ _confirmStatus: "success", _signInState: "done" }, () => this.forceUpdate());
            if (actions?.trigger_snackbar) {
                actions.trigger_snackbar(t("components.create_account_dialog.welcome_back", {
                    _username: this.state._username
                }), "success");
            }
        } else {
            const errorMsg = t("components.create_account_dialog.could_not_start_a_session_please_try_again");
            this.setState({ _confirmStatus: "error", _errorMessage: errorMsg }, () => this.forceUpdate());
        }
    };

    _handleTabChange = (e, value) => {
        const previous_value = this.state._tab_value;
        const target = parseInt(value, 10);
        // Forward navigation is gated by _can_click_next on the *current* tab.
        // Back navigation is always allowed (unless creating).
        if (target > previous_value && !this._can_click_next()) return;
        if (this.state._creating_account) return;

        this.setState({ _tab_value: target }, () => {
            this.forceUpdate(() => {
                try { this.swipeableViewScrollTop(); } catch (_) {}
                // Transitioning into the CONFIRM step kicks off the actual work.
                if (previous_value === 1 && target === 2) {
                    if (this.state._recoveryMode) {
                        this._recoverAndLogin();
                    } else {
                        this._createAccountOnChain();
                    }
                }
            });
        });
    };

    _handleFinalConfirm = () => {
        // Step 2 OK button (TRY AGAIN after a failed sign-in): route through
        // the unified close handler, so the backup-must-be-saved gate is
        // honored and the new account is signed in on the way out (_mayClose).
        if (this.state._confirmStatus === "success") {
            this._handleDialogClose();
        }
    };

    /**
     * Has the person typed anything this dialog would throw away? The fields
     * they fill in themselves: username, password, phone, code, recovery seed
     * words. A pre-filled dial code, a generated seed or a ticked checkbox
     * alone is not input worth asking about.
     */
    _hasUserInput = () => {
        const s = this.state;
        return s._tab_value > 0 ||
            String(s._username || "").length > 0 ||
            String(s._password || "").length > 0 ||
            String(s._phoneRaw || "").length > 0 ||
            String(s._phoneFormatted || "").length > 0 ||
            String(s._confirmationCode || "").length > 0 ||
            String(s._seed_word_input || "").length > 0 ||
            (s._recoveryMode && Array.isArray(s._seed) && s._seed.length > 0);
    };

    /**
     * May the dialog close right now? Every way out asks — CANCEL, OK,
     * Escape, a backdrop click, and the shell when the address drops
     * "+signup" (back arrow; see _closeGuard). When the answer is no, the
     * person is shown why:
     *
     *  - while creating/recovering: never (the on-chain transaction runs);
     *  - once the account exists: only with its backup PDF saved — no
     *    auto-close, no forced download on the way out (a download the
     *    person cancelled went unnoticed that way); a refused close says so.
     *    With the backup saved, closing a finished sign-up signs the new
     *    account in first (_signInAndClose), and the dialog goes once that
     *    is done — or, after a failed sign-in, when the person picks CLOSE;
     *  - before that: freely when nothing was typed, otherwise only once the
     *    person has confirmed in the white "Quit the sign-up?" modal.
     */
    _mayClose = () => {
        const { _creating_account, _confirmStatus, _pdfBlob, _pdfConfirmed, _signInState } = this.state;
        if (_creating_account || _confirmStatus === "working") return false;
        if (_confirmStatus === "success") {
            if (_pdfBlob && !_pdfConfirmed) {
                this._remindPdf();
                return false;
            }
            if (_signInState === "done" || this._leaveSignedOut) return true;
            this._signInAndClose(); // closes by itself once signed in
            return false;
        }
        if (!this._quitConfirmed && this._hasUserInput()) {
            this._openQuitConfirm();
            return false;
        }
        return true;
    };

    // Registered with the shell (Index.js §8c, via props.registerCloseGuard):
    // asked before the address takes this dialog down. true holds it open.
    _closeGuard = () => !this._mayClose();

    _remindPdf = () => {
        this.setState({ _pdfReminder: (this.state._pdfReminder || 0) + 1 }, () => this.forceUpdate());
    };

    _openQuitConfirm = () => {
        if (this.state._quitConfirmOpen) return;
        this.setState({ _quitConfirmOpen: true }, () => this.forceUpdate());
    };

    // "CONTINUE" (or Escape / a click beside the white modal): back to the form.
    _handleQuitStay = () => {
        this.setState({ _quitConfirmOpen: false }, () => this.forceUpdate());
    };

    // "QUIT": the person let go of what they typed — every close goes through now.
    _handleQuitConfirm = () => {
        this._quitConfirmed = true;
        this.setState({ _quitConfirmOpen: false }, () => {
            this.forceUpdate();
            this._handleDialogClose();
        });
    };

    /**
     * Universal close handler — CANCEL, OK, Escape, backdrop. Closes through
     * props.onClose (the address, when opened as "+signup") only when
     * _mayClose agrees; otherwise _mayClose has already shown why not.
     */
    _handleDialogClose = (event, reason) => {
        if (!this._mayClose()) return;
        if (this._advancedOpenTimer) { clearTimeout(this._advancedOpenTimer); this._advancedOpenTimer = null; }
        if (this.props.onClose) this.props.onClose(event, reason);
    };

    swipeableViewScrollTop = () => {
        let views = document.getElementsByClassName("react-swipeable-view-container"), i = 0;
        let view = views.item(0);
        let child = view.children.item(0);
        child.style.scrollBehavior = "smooth";
        child.scrollTop = 0;
    };

    _handlePasswordChange = (e) => {
        this.setState({_password: e.target.value.toString()}, () => {
            this.forceUpdate();
        });
    };

    _update_seed = (e) => {

        this.setState({_seed: e}, () => {
            this.forceUpdate();
        });
    };

    _delete_within_seed = (e) => {
        let seed = this.state._seed;
        this.setState({_seed:  seed.filter((w) => e.indexOf(w) === -1)}, () => {
            this.forceUpdate();
        });
    };

    _add_within_seed = (e) => {
        let seed = this.state._seed;
        this.setState({_seed:  seed.concat(e)}, () => {
            this.forceUpdate();
        });
    };

    _handleClickShowPassword = () => {
        this.setState({_showPassword: !this.state._showPassword}, () => {
            this.forceUpdate();
        });
    }

    _set_seed_phrase_anchor = (target) => {
        this.setState({_seed_menu_anchor: target}, () => {
            this.forceUpdate();
        })
    }

    /**
     * Parse a bulk-pasted seed phrase. Supports raw space-separated words as
     * well as numbered formats like "1. worth 2. album 3. welcome ...",
     * "1) worth 2) album ...", "(1) worth (2) album ...", with arbitrary
     * whitespace/commas/newlines between tokens.
     *
     * Returns an array of candidate letter tokens, NFC-normalised (no
     * validation yet).
     */
    _parse_bulk_seed = (raw) => {
        if (typeof raw !== "string") return [];
        // Strip numeric prefixes: "1.", "12)", "(3)", "4:", "5-", etc.
        // Replace them with a space so the surrounding word survives.
        const stripped = raw
            .replace(/\(?\s*\d+\s*[\.\)\:\-]\s*/g, " ")
            .replace(/[,;]+/g, " ");
        // Split on any whitespace (incl. U+3000 in Japanese pastes) and keep
        // letter tokens from ANY wordlist alphabet — \p{M} admits combining
        // accents/jamo so NFKD pastes (e.g. copied out of a PDF) survive the
        // filter. NFC-normalise so tokens compare equal to getWordsPossible's
        // NFC output during validation.
        return stripped
            .toLowerCase()
            .split(/\s+/u)
            .map((t) => t.trim().normalize("NFC"))
            .filter((t) => t.length > 0 && /^[\p{L}\p{M}]+$/u.test(t));
    };

    /**
     * Validate each candidate against the BIP39 wordlist (via getWordsPossible).
     * A token is accepted only if it exactly matches a wordlist entry — i.e. it
     * appears in its own suggestion list. This prevents typos / non-mnemonic
     * tokens from polluting the chip list. getWordsPossible searches the UI
     * language's wordlist and merges English, so both freshly-issued localised
     * seeds and legacy English seeds validate on any UI language.
     */
    _validate_seed_words = async (candidates) => {
        const valid = [];
        for (const word of candidates) {
            try {
                const suggestions = await getWordsPossible(word, getLanguage(), 5);
                if (Array.isArray(suggestions) && suggestions.indexOf(word) !== -1) {
                    valid.push(word);
                }
            } catch (_) {
                // ignore — treat as invalid
            }
        }
        return valid;
    };

    /**
     * Try to handle `input` as a bulk seed paste. Returns true if it was
     * handled as a bulk paste (and the seed state was updated), false otherwise.
     *
     * Heuristic: we treat input as bulk only when, after parsing, it yields
     * 2+ alpha tokens. A single typed word goes through the normal suggestion
     * flow so the user can still type one word at a time.
     */
    _try_bulk_seed_paste = async (input) => {
        const candidates = this._parse_bulk_seed(input);
        if (candidates.length < 2) return false;

        const valid = await this._validate_seed_words(candidates);
        if (valid.length === 0) return false;

        // Append only words not already present (chips are unique by value).
        const existing = this.state._seed || [];
        const toAdd = valid.filter((w) => existing.indexOf(w) === -1);
        if (toAdd.length === 0) {
            // Nothing new — still clear the input so the user sees it was consumed.
            this.setState({_seed_word_input: "", _seed_word_suggestion: []}, () => {
                this.forceUpdate();
            });
            return true;
        }

        this.setState({
            _seed: existing.concat(toAdd),
            _seed_word_input: "",
            _seed_word_suggestion: [],
        }, () => {
            this.forceUpdate();
        });
        return true;
    };

    _on_seed_input = (input) => {
        // Detect a bulk paste (multiple words / numbered list) and dispatch
        // through the bulk handler. Otherwise fall back to the normal
        // single-word-with-suggestions flow.
        const looksLikeBulk =
            typeof input === "string" &&
            (/\s/.test(input.trim()) || /\d/.test(input));

        if (looksLikeBulk) {
            this._try_bulk_seed_paste(input).then((handled) => {
                if (!handled) {
                    // Not a recognisable bulk paste — keep normal behaviour.
                    this.setState({_seed_word_input: input}, () => {
                        this._set_suggestion();
                    });
                }
            });
            return;
        }

        this.setState({_seed_word_input: input}, () => {
            this._set_suggestion();
        });
    };

    _get_username_message = () => {
        const {
            _username_syntax_error,
            _pending_username_validation,
            _username_available,
            _recoveryMode,
        } = this.state;

        if (_username_syntax_error && _username_syntax_error.length) return _username_syntax_error;
        if (_pending_username_validation) return t("components.create_account_dialog.pending_validation");
        if (!_username_available) {
            return _recoveryMode
                ? t("components.create_account_dialog.recovery_mode_enter_your_seed_phrase_below")
                : t("components.create_account_dialog.username_already_taken");
        }
        return "";
    };

    // Stable step-navigation handlers — were closures re-created per render.
    _onSwipeIndexChange = (v) => this._handleTabChange({}, v);
    _goToPreviousStep = () => this._handleTabChange({}, this.state._tab_value - 1);
    _goToConfirmStep = () => this._handleTabChange({}, 2);

    render() {
        const {
            classes,
            open,
            _fullscreen,
            _compactStepper,
            _tab_value,
            _creating_account,
            _username,
            _seed,
            _seed_menu_anchor,
            _seed_word_input,
            _seed_word_suggestion,
            _password,
            _showPassword,
            _username_syntax_error,
            _pending_username_validation,
            _username_available,
            // New flow
            _advancedOpen,
            _termsAccepted,
            _termsModalOpen,
            _termsTab,
            _recoveryMode,
            _country,
            _dialCode,
            _phoneRaw,
            _phoneFormatted,
            _phoneMask,
            _codeSent,
            _sendingCode,
            _confirmationCode,
            _codeStatus,
            _sendError,
            _phoneError,
            _codeError,
            _resendInSec,
            _capacity,
            _phoneCheck,
            _phoneChecking,
            _nextSendAllowedAt,
            _voucher,
            _recoveryStatus,
            _confirmStatus,
            _errorMessage,
            _pdfBlob,
            _pdfDownloaded,
            _pdfSaving,
            _pdfVerified,
            _pdfConfirmed,
            _pdfNotice,
            _pdfReminder,
            _quitConfirmOpen,
            _signInState,
            _signInError,
        } = this.state;

        const username_message = this._get_username_message();
        const signingIn = _signInState === "pending";

        return (
            <React.Fragment>
                <Dialog className={classes.dialog}
                        open={open}
                        fullScreen={_fullscreen}
                        fullWidth={true}
                        maxWidth={"md"}
                        disablePortal={false}
                        disableBackdropClick={_creating_account || _confirmStatus === "working" || signingIn}
                        disableEscapeKeyDown={_creating_account || _confirmStatus === "working" || signingIn}
                        onClose={this._handleDialogClose}
                        keepMounted={false}>
                    <div className={classes.flexDesktop}>
                        <div className={classes.smallDesktopHidden}>
                            <Fade in timeout={300}>
                                <img src={pixaLogoWhite}  style={ST_W_100__MAXW_360PX__US_NONE}/>
                            </Fade>
                            <Fade in timeout={600}>
                                <Typography style={ST_W_360PX__FS_60PX__FW_400} variant={"h2"} component={"h2"}>{t("components.create_account_dialog.join_pixa")}</Typography>
                            </Fade>
                            <Fade in timeout={900}>
                                <Typography style={ST_W_360PX__FS_20PX__FW_400} variant={"h4"} component={"h3"}>{t("components.create_account_dialog.just_be_yourself")}</Typography>
                            </Fade>
                        </div>
                        <div className={classes.floatRightDesktop}>
                            {/* Sticky Stepper at top */}
                            <div className={classes.stepperContainer}>
                                <Fade in timeout={300}>
                                    <Stepper
                                        activeStep={_tab_value}
                                        alternativeLabel={_compactStepper}
                                        className={_compactStepper ? classes.stepperCompact : undefined}
                                        style={_compactStepper ? ST_STEPPER_COMPACT : ST_P_24PX}
                                    >
                                        <Step completed={_tab_value > 0}>
                                            <StepLabel>{t("words.generate", {TUC: true})}</StepLabel>
                                        </Step>
                                        <Step completed={_tab_value > 1}>
                                            <StepLabel>{t("words.verify", {TUC: true})}</StepLabel>
                                        </Step>
                                        <Step completed={_tab_value > 2}>
                                            <StepLabel>{t("words.confirm", {TUC: true})}</StepLabel>
                                        </Step>
                                    </Stepper>
                                </Fade>
                            </div>

                            {/* Scrollable content area */}
                            <div className={classes.swipeableContainer}>
                                <Fade in timeout={600}>
                                    <SwipeableViews
                                        ignoreNativeScroll={true}
                                        containerStyle={SWIPE_CONTAINER_STYLE}
                                        animateTransitions={true}
                                        disableLazyLoading={true}
                                        resistance={true}
                                        springConfig={SWIPE_SPRING_CONFIG}
                                        index={_tab_value}
                                        onChangeIndex={this._onSwipeIndexChange}
                                        disabled={true}
                                        key={"swipe-able-view"}
                                    >
                                        <StepGenerate
                                            classes={classes}
                                            username={_username}
                                            usernameMessage={username_message}
                                            usernameSyntaxError={_username_syntax_error}
                                            pendingUsernameValidation={_pending_username_validation}
                                            usernameAvailable={_username_available}
                                            seed={_seed}
                                            seedMenuAnchor={_seed_menu_anchor}
                                            seedWordInput={_seed_word_input}
                                            seedWordSuggestion={_seed_word_suggestion}
                                            password={_password}
                                            showPassword={_showPassword}
                                            advancedOpen={_advancedOpen}
                                            termsAccepted={_termsAccepted}
                                            onToggleAdvanced={this._handleToggleAdvanced}
                                            onTermsToggle={this._handleTermsToggle}
                                            onOpenTerms={this._handleOpenTerms}
                                            capacity={_capacity}
                                            onRefreshCapacity={this._fetchCapacity}
                                            onUsernameChange={this._handleUsernameChange}
                                            onSeedInput={this._on_seed_input}
                                            onBeforeSeedWordAdd={this._before_seed_word_add}
                                            onAddWithinSeed={this._add_within_seed}
                                            onDeleteWithinSeed={this._delete_within_seed}
                                            onSetSeedPhraseAnchor={this._set_seed_phrase_anchor}
                                            onGenerateNewSeed={this._generate_new_seed}
                                            onPasswordChange={this._handlePasswordChange}
                                            onClickShowPassword={this._handleClickShowPassword}
                                            onMouseDownPassword={this._handleMouseDownPassword}
                                        />
                                        <StepVerify
                                            classes={classes}
                                            recoveryMode={_recoveryMode}
                                            seed={_seed}
                                            recoveryStatus={_recoveryStatus}
                                            onVerifyRecovery={this._verifyRecovery}
                                            dialCode={_dialCode}
                                            country={_country}
                                            phoneRaw={_phoneRaw}
                                            phoneFormatted={_phoneFormatted}
                                            phoneMask={_phoneMask}
                                            codeSent={_codeSent}
                                            sendingCode={_sendingCode}
                                            confirmationCode={_confirmationCode}
                                            codeStatus={_codeStatus}
                                            onDialCodeChange={this._handleDialCodeChange}
                                            onPhoneChange={this._handlePhoneChange}
                                            onPhonePaste={this._handlePhonePaste}
                                            onSendCode={this._sendCode}
                                            onCodeChange={this._handleCodeChange}
                                            onVerifyCode={this._verifyCode}
                                            sendError={_sendError}
                                            phoneError={_phoneError}
                                            codeError={_codeError}
                                            resendInSec={_resendInSec}
                                            capacity={_capacity}
                                            phoneCheck={_phoneCheck}
                                            phoneChecking={_phoneChecking}
                                            nextSendAllowedAt={_nextSendAllowedAt}
                                            onCountrySelect={this._handleCountrySelect}
                                        />
                                        <StepConfirm
                                            classes={classes}
                                            status={_confirmStatus}
                                            recoveryMode={_recoveryMode}
                                            errorMessage={_errorMessage}
                                            hasPdfBlob={Boolean(_pdfBlob)}
                                            pdfDownloaded={_pdfDownloaded}
                                            pdfSaving={_pdfSaving}
                                            pdfVerified={_pdfVerified}
                                            pdfConfirmed={_pdfConfirmed}
                                            pdfNotice={_pdfNotice}
                                            pdfReminder={_pdfReminder}
                                            onDownloadPdf={this._trigger_pdf_download}
                                            onTogglePdfConfirmed={this._handlePdfConfirmedToggle}
                                            username={_username}
                                            signInState={_signInState}
                                            signInError={_signInError}
                                        />
                                    </SwipeableViews>
                                </Fade>
                            </div>

                            {/* Sticky Actions at bottom */}
                            <Fade in timeout={900}>
                                <DialogActions className={classes.dialogActions}>
                                    <Fade in={_tab_value > 0 && (_tab_value < 2 || _confirmStatus === "error")}>
                                        <Button variant="text" color="primary" onClick={this._goToPreviousStep} disabled={_tab_value === 0 || (_tab_value === 2 && _confirmStatus !== "error") || _creating_account}>{t("words.back", {TUC: true})}</Button>
                                    </Fade>
                                    {_tab_value < 2 && (
                                        <Button variant="contained" color="primary" onClick={this._handleDialogClose} disabled={_creating_account}>{t("words.cancel", {TUC: true})}</Button>
                                    )}
                                    {_tab_value === 0 ? (
                                        <Button
                                            className={classes.whiteButton}
                                            variant="contained"
                                            color="primary"
                                            autoFocus
                                            onClick={this._handleNextFromGenerate}
                                            disabled={!this._first_step_done()}
                                        >
                                            {_recoveryMode ? t("components.create_account_dialog.recover") : t("words.next", {TUC: true})}
                                        </Button>
                                    ) : _tab_value === 1 ? (
                                        <Button
                                            className={classes.whiteButton}
                                            variant="contained"
                                            color="primary"
                                            autoFocus
                                            onClick={this._goToConfirmStep}
                                            disabled={!this._can_click_next()}
                                        >{t("words.next", {TUC: true})} </Button>
                                    ) : (
                                        <React.Fragment>
                                            {/* A failed sign-in: leave without it. */}
                                            {_signInState === "failed" && (
                                                <Button variant="text" color="primary" onClick={this._handleCloseSignedOut}>
                                                    {t("words.close", {TUC: true})}
                                                </Button>
                                            )}
                                            {/* OK closes — and, after a sign-up, signs the new account in first. */}
                                            <Button
                                                className={classes.whiteButton}
                                                variant="contained"
                                                color="primary"
                                                autoFocus
                                                onClick={this._handleFinalConfirm}
                                                disabled={_confirmStatus !== "success" || (Boolean(_pdfBlob) && !_pdfConfirmed) || signingIn}
                                                startIcon={signingIn ? <CircularProgress size={16} color="inherit" /> : null}
                                            >
                                                {signingIn
                                                    ? t("components.create_account_dialog.signing_in")
                                                    : _signInState === "failed"
                                                        ? t("components.create_account_dialog.try_again")
                                                        : "OK"}
                                            </Button>
                                        </React.Fragment>
                                    )}
                                </DialogActions>
                            </Fade>
                        </div>
                    </div>
                </Dialog>
                {/* Terms of Use / Privacy Policy modal — opened only from the
                    underlined names in the step-0 agreement sentence, on the
                    tab of the one clicked (TermsAgreementLabel). Renders the
                    same two components as AppInfoDialog (strings in
                    locales/en.js under components.terms_of_use /
                    components.privacy_policy). */}
                <Dialog
                    className={classes.termsDialog}
                    open={_termsModalOpen}
                    onClose={this._handleTermsModalClose}
                    fullScreen={_fullscreen}
                    fullWidth={true}
                    maxWidth={"md"}
                >
                    <DialogTitle>{t(TERMS_MODAL_TITLE_KEYS[_termsTab] || TERMS_MODAL_TITLE_KEYS[0])}</DialogTitle>
                    <Tabs
                        className={classes.termsTabs}
                        value={_termsTab}
                        variant="fullWidth"
                        indicatorColor="primary"
                        textColor="primary"
                        onChange={this._handleTermsTabChange}
                    >
                        <Tab icon={t(TERMS_MODAL_TITLE_KEYS[0])} />
                        <Tab icon={t(TERMS_MODAL_TITLE_KEYS[1])} />
                    </Tabs>
                    <DialogContent ref={this._setTermsContentRef} className={classes.termsContent}>
                        {_termsTab === 1 ? <PrivacyPolicy/> : <TermsOfUse/>}
                    </DialogContent>
                    <DialogActions>
                        <Button variant="text" color="primary" onClick={this._handleTermsModalClose}>
                            {t("words.close", {TUC: true})}
                        </Button>
                    </DialogActions>
                </Dialog>
                {/* "Quit the sign-up?" — a fully white modal over the dark
                    dialog, shown only when something was typed (_mayClose).
                    Escape or a click beside it keeps the sign-up going. */}
                <Dialog
                    className={classes.quitDialog}
                    open={_quitConfirmOpen}
                    onClose={this._handleQuitStay}
                    fullWidth={true}
                    maxWidth={"xs"}
                    aria-labelledby="cad-quit-title"
                    aria-describedby="cad-quit-text"
                >
                    <DialogTitle id="cad-quit-title">{t("components.create_account_dialog.quit_the_sign_up")}</DialogTitle>
                    <DialogContent id="cad-quit-text">
                        <Typography component="p" variant="body1">
                            {t("components.create_account_dialog.what_you_have_entered_so_far_will_be")}
                        </Typography>
                        {_voucher ? (
                            <Typography component="p" variant="body1" style={ST_MT_8}>
                                {t("components.create_account_dialog.your_phone_number_is_verified_for_this_sign")}
                            </Typography>
                        ) : _codeSent ? (
                            <Typography component="p" variant="body1" style={ST_MT_8}>
                                {t("components.create_account_dialog.a_confirmation_code_was_already_sent_to_your")}
                            </Typography>
                        ) : null}
                    </DialogContent>
                    <DialogActions>
                        <Button variant="text" className="quitLeave" onClick={this._handleQuitConfirm}>
                            {t("components.create_account_dialog.quit")}
                        </Button>
                        <Button variant="contained" className="quitStay" onClick={this._handleQuitStay} autoFocus>
                            {t("components.create_account_dialog.continue")}
                        </Button>
                    </DialogActions>
                </Dialog>
                {/* Hidden form for browser password manager integration.
                    On account creation success, this form is submitted to trigger
                    the browser's "Save password?" prompt. The saved posting key
                    can then autofill LoginDialog's password field. */}
                <form
                    ref={this._credentialFormRef}
                    action="javascript:void(0)"
                    method="POST"
                    style={ST_POS_ABSOLUTE__W_0__H_0}
                    aria-hidden="true"
                    tabIndex={-1}
                >
                    <input type="text" name="username" autoComplete="username" tabIndex={-1} />
                    <input type="password" name="password" autoComplete="current-password" tabIndex={-1} />
                </form>
            </React.Fragment>
        );
    }
}

export default withLanguage(withStyles(styles)(CreateAccountDialog));