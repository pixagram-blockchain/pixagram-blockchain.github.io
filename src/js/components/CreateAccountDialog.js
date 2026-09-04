import * as React from "preact/compat";
import { memo, useCallback, useMemo, useState, useEffect } from "preact/compat";
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
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Tooltip from "@material-ui/core/Tooltip";
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
const ST_C_7B7B7B__FS_13__TA_CENTER = { color: "#7b7b7b", fontSize: 13, textAlign: "center" };
const ST_C_BDBDBD__FSTY_ITALIC__FS_14 = { color: "#bdbdbd", fontStyle: "italic", fontSize: 14, textAlign: "center" };
const ST_W_100__MAXW_360PX__US_NONE = { width: "100%", maxWidth: "360px", userSelect: "none", pointerEvents: "none" };
const ST_W_360PX__FS_60PX__FW_400 = { width: "360px", fontSize: "60px", fontWeight: "400", margin: "-24px 16px 0px 16px" };
const ST_W_360PX__FS_20PX__FW_400 = { width: "360px", fontSize: "20px", fontWeight: "400", margin: "24px 16px" };
const ST_P_24PX = { padding: "24px" };
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

// Auto-close delay on the final success screen.
const AUTO_CLOSE_MS = 6000;

// =============================================================================
// Phone mask data — array of [ISO2, mask] tuples. Multiple masks per country
// are allowed (the JSON source had duplicate keys for variable-length numbers).
// We pick the mask that best fits the current input length on each keystroke.
// =============================================================================
const PHONE_MASKS = [
    ["AC", "+247-####"], ["AD", "+376-###-###"], ["AE", "+971-5#-###-####"], ["AE", "+971-#-###-####"],
    ["AF", "+93-##-###-####"], ["AG", "+1(268)###-####"], ["AI", "+1(264)###-####"], ["AL", "+355(###)###-###"],
    ["AM", "+374-##-###-###"], ["AN", "+599-###-####"], ["AN", "+599-9###-####"], ["AO", "+244(###)###-###"],
    ["AQ", "+672-1##-###"], ["AR", "+54(###)###-####"], ["AS", "+1(684)###-####"], ["AT", "+43(###)###-####"],
    ["AU", "+61-#-####-####"], ["AW", "+297-###-####"], ["AZ", "+994-##-###-##-##"], ["BA", "+387-##-#####"],
    ["BA", "+387-##-####"], ["BB", "+1(246)###-####"], ["BD", "+880-##-###-###"], ["BE", "+32(###)###-###"],
    ["BF", "+226-##-##-####"], ["BG", "+359(###)###-###"], ["BH", "+973-####-####"], ["BI", "+257-##-##-####"],
    ["BJ", "+229-##-##-####"], ["BM", "+1(441)###-####"], ["BN", "+673-###-####"], ["BO", "+591-#-###-####"],
    ["BR", "+55(##)####-####"], ["BR", "+55(##)7###-####"], ["BR", "+55(##)9####-####"], ["BS", "+1(242)###-####"],
    ["BT", "+975-17-###-###"], ["BT", "+975-#-###-###"], ["BW", "+267-##-###-###"], ["BY", "+375(##)###-##-##"],
    ["BZ", "+501-###-####"], ["CA", "+1(###)###-####"], ["CD", "+243(###)###-###"], ["CF", "+236-##-##-####"],
    ["CG", "+242-##-###-####"], ["CH", "+41-##-###-####"], ["CI", "+225-##-###-###"], ["CK", "+682-##-###"],
    ["CL", "+56-#-####-####"], ["CM", "+237-####-####"], ["CN", "+86(###)####-####"], ["CN", "+86(###)####-###"],
    ["CN", "+86-##-#####-#####"], ["CO", "+57(###)###-####"], ["CR", "+506-####-####"], ["CU", "+53-#-###-####"],
    ["CV", "+238(###)##-##"], ["CW", "+599-###-####"], ["CY", "+357-##-###-###"], ["CZ", "+420(###)###-###"],
    ["DE", "+49(####)###-####"], ["DE", "+49(###)###-####"], ["DE", "+49(###)##-####"], ["DE", "+49(###)##-###"],
    ["DE", "+49(###)##-##"], ["DE", "+49-###-###"], ["DJ", "+253-##-##-##-##"], ["DK", "+45-##-##-##-##"],
    ["DM", "+1(767)###-####"], ["DO", "+1(809)###-####"], ["DO", "+1(829)###-####"], ["DO", "+1(849)###-####"],
    ["DZ", "+213-##-###-####"], ["EC", "+593-##-###-####"], ["EC", "+593-#-###-####"], ["EE", "+372-####-####"],
    ["EE", "+372-###-####"], ["EG", "+20(###)###-####"], ["ER", "+291-#-###-###"], ["ES", "+34(###)###-###"],
    ["ET", "+251-##-###-####"], ["FI", "+358(###)###-##-##"], ["FJ", "+679-##-#####"], ["FK", "+500-#####"],
    ["FM", "+691-###-####"], ["FO", "+298-###-###"], ["FR", "+262-#####-####"], ["FR", "+33(###)###-###"],
    ["FR", "+508-##-####"], ["FR", "+590(###)###-###"], ["GA", "+241-#-##-##-##"], ["GD", "+1(473)###-####"],
    ["GE", "+995(###)###-###"], ["GF", "+594-#####-####"], ["GH", "+233(###)###-###"], ["GI", "+350-###-#####"],
    ["GL", "+299-##-##-##"], ["GM", "+220(###)##-##"], ["GN", "+224-##-###-###"], ["GQ", "+240-##-###-####"],
    ["GR", "+30(###)###-####"], ["GT", "+502-#-###-####"], ["GU", "+1(671)###-####"], ["GW", "+245-#-######"],
    ["GY", "+592-###-####"], ["HK", "+852-####-####"], ["HN", "+504-####-####"], ["HR", "+385-##-###-###"],
    ["HT", "+509-##-##-####"], ["HU", "+36(###)###-###"], ["ID", "+62(8##)###-####"], ["ID", "+62-##-###-##"],
    ["ID", "+62-##-###-###"], ["ID", "+62-##-###-####"], ["ID", "+62(8##)###-###"], ["ID", "+62(8##)###-##-###"],
    ["IE", "+353(###)###-###"], ["IL", "+972-5#-###-####"], ["IL", "+972-#-###-####"], ["IN", "+91(####)###-###"],
    ["IO", "+246-###-####"], ["IQ", "+964(###)###-####"], ["IR", "+98(###)###-####"], ["IS", "+354-###-####"],
    ["IT", "+39(###)####-###"], ["JM", "+1(876)###-####"], ["JO", "+962-#-####-####"], ["JP", "+81-##-####-####"],
    ["JP", "+81(###)###-###"], ["KE", "+254-###-######"], ["KG", "+996(###)###-###"], ["KH", "+855-##-###-###"],
    ["KI", "+686-##-###"], ["KM", "+269-##-#####"], ["KN", "+1(869)###-####"], ["KP", "+850-191-###-####"],
    ["KP", "+850-##-###-###"], ["KP", "+850-###-####-###"], ["KP", "+850-###-###"], ["KP", "+850-####-####"],
    ["KP", "+850-####-#############"], ["KR", "+82-##-###-####"], ["KW", "+965-####-####"], ["KY", "+1(345)###-####"],
    ["KZ", "+7(6##)###-##-##"], ["KZ", "+7(7##)###-##-##"], ["LA", "+856(20##)###-###"], ["LA", "+856-##-###-###"],
    ["LB", "+961-##-###-###"], ["LB", "+961-#-###-###"], ["LC", "+1(758)###-####"], ["LI", "+423(###)###-####"],
    ["LK", "+94-##-###-####"], ["LR", "+231-##-###-###"], ["LS", "+266-#-###-####"], ["LT", "+370(###)##-###"],
    ["LU", "+352(###)###-###"], ["LV", "+371-##-###-###"], ["LY", "+218-##-###-###"], ["LY", "+218-21-###-####"],
    ["MA", "+212-##-####-###"], ["MC", "+377(###)###-###"], ["MC", "+377-##-###-###"], ["MD", "+373-####-####"],
    ["ME", "+382-##-###-###"], ["MG", "+261-##-##-#####"], ["MH", "+692-###-####"], ["MK", "+389-##-###-###"],
    ["ML", "+223-##-##-####"], ["MM", "+95-##-###-###"], ["MM", "+95-#-###-###"], ["MM", "+95-###-###"],
    ["MN", "+976-##-##-####"], ["MO", "+853-####-####"], ["MP", "+1(670)###-####"], ["MQ", "+596(###)##-##-##"],
    ["MR", "+222-##-##-####"], ["MS", "+1(664)###-####"], ["MT", "+356-####-####"], ["MU", "+230-###-####"],
    ["MV", "+960-###-####"], ["MW", "+265-1-###-###"], ["MW", "+265-#-####-####"], ["MX", "+52(###)###-####"],
    ["MX", "+52-##-##-####"], ["MY", "+60-##-###-####"], ["MY", "+60(###)###-###"], ["MY", "+60-##-###-###"],
    ["MY", "+60-#-###-###"], ["MZ", "+258-##-###-###"], ["NA", "+264-##-###-####"], ["NC", "+687-##-####"],
    ["NE", "+227-##-##-####"], ["NF", "+672-3##-###"], ["NG", "+234(###)###-####"], ["NG", "+234-##-###-###"],
    ["NG", "+234-##-###-##"], ["NI", "+505-####-####"], ["NL", "+31-##-###-####"], ["NO", "+47(###)##-###"],
    ["NP", "+977-##-###-###"], ["NR", "+674-###-####"], ["NU", "+683-####"], ["NZ", "+64(###)###-###"],
    ["NZ", "+64-##-###-###"], ["NZ", "+64(###)###-####"], ["OM", "+968-##-###-###"], ["PA", "+507-###-####"],
    ["PE", "+51(###)###-###"], ["PF", "+689-##-##-##"], ["PG", "+675(###)##-###"], ["PH", "+63(###)###-####"],
    ["PK", "+92(###)###-####"], ["PL", "+48(###)###-###"], ["PS", "+970-##-###-####"], ["PT", "+351-##-###-####"],
    ["PW", "+680-###-####"], ["PY", "+595(###)###-###"], ["QA", "+974-####-####"], ["RE", "+262-#####-####"],
    ["RO", "+40-##-###-####"], ["RS", "+381-##-###-####"], ["RU", "+7(###)###-##-##"], ["RW", "+250(###)###-###"],
    ["SA", "+966-5-####-####"], ["SA", "+966-#-###-####"], ["SB", "+677-###-####"], ["SB", "+677-#####"],
    ["SC", "+248-#-###-###"], ["SD", "+249-##-###-####"], ["SE", "+46-##-###-####"], ["SG", "+65-####-####"],
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
    ["ZA", "+27-##-###-####"], ["ZM", "+260-##-###-####"], ["ZW", "+263-#-######"]
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
};

// Extract the dialing prefix (literal digits only) from a mask.
// Examples:
//   "+41-##-###-####"     -> "41"
//   "+1(###)###-####"     -> "1"     (the ### are slots, not literals)
//   "+1(268)###-####"     -> "1268"  (Antigua: 268 is a literal area code)
//   "+44-##-####-####"    -> "44"
const dialPrefixFromMask = (mask) => {
    if (!mask) return "";
    // Walk the mask char by char after the leading "+", collecting digits and
    // bridging across one optional "(" if the next char inside is a literal
    // digit (not a # slot).
    if (mask[0] !== "+") return "";
    let i = 1;
    let prefix = "";
    while (i < mask.length && /\d/.test(mask[i])) { prefix += mask[i++]; }
    // Optional: a "(" right after the country code, with literal digits inside.
    if (mask[i] === "(" && /\d/.test(mask[i + 1] || "")) {
        i++; // consume "("
        while (i < mask.length && /\d/.test(mask[i])) { prefix += mask[i++]; }
        // We don't actually care about the closing ")" — we've captured the
        // literal digits. The mask remains usable.
    }
    return prefix;
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
            const match = String(lng).match(/[-_]([A-Z]{2})/i);
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
 * Pick the best mask for a country given the current digit count.
 * Prefers the mask whose `#` count is >= digit count and is the smallest such;
 * falls back to the longest mask if all are too short.
 */
const pickBestMask = (country, digitCount) => {
    const candidates = MASKS_BY_COUNTRY[country] || [];
    if (candidates.length === 0) return null;
    const withCounts = candidates.map(m => ({ mask: m, slots: (m.match(/#/g) || []).length }));
    const fits = withCounts.filter(c => c.slots >= digitCount).sort((a, b) => a.slots - b.slots);
    if (fits.length > 0) return fits[0].mask;
    return withCounts.sort((a, b) => b.slots - a.slots)[0].mask;
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
// Two cases:
//  - Slots in parens, like "+1(###)###-####": parens enclose ### slots, so the
//    subscriber INCLUDES the "(" — result "(###)###-####". The country code is
//    just "+1".
//  - Literals in parens, like "+1(268)###-####": parens enclose literal area-
//    code digits that identify the specific country/region (Antigua, etc.).
//    Strip the entire "+1(268)" — subscriber is "###-####".
const stripPrefixFromMask = (mask) => {
    if (!mask) return "";
    if (mask[0] !== "+") return mask;
    let i = 1;
    while (i < mask.length && /\d/.test(mask[i])) i++;
    if (mask[i] === "(" && /\d/.test(mask[i + 1] || "")) {
        // Literal digits in parens — strip them and the closing ).
        i++;
        while (i < mask.length && /\d/.test(mask[i])) i++;
        if (mask[i] === ")") i++;
    }
    // Skip ONE optional separator character if it's "-" or " ".
    if (mask[i] === "-" || mask[i] === " ") i++;
    return mask.slice(i);
};

// Best subscriber-only mask for a country given current subscriber digit count.
const pickSubscriberMask = (country, digitCount) => {
    const full = pickBestMask(country, digitCount);
    return stripPrefixFromMask(full);
};

// Format subscriber-only digits under the country's mask.
const formatSubscriber = (digits, country) => {
    const fullMask = pickBestMask(country, digits.length);
    if (!fullMask) return digits;
    const subscriberMask = stripPrefixFromMask(fullMask);
    return applyMask(String(digits || ""), subscriberMask).formatted;
};

// Country code (digits, no +) for a given ISO2.
const dialCodeFor = (country) => {
    const mask = pickBestMask(country, 0);
    return mask ? dialPrefixFromMask(mask) : "";
};

// Walk known prefixes (longest first) and return the country whose dial code
// matches the leading digits. Used when the user pastes/types a "+..." number
// and we want to auto-switch country.
//
// PREFERRED_COUNTRY overrides resolve ambiguity for shared prefixes (e.g.
// prefix "1" maps to many NANP countries; we prefer US over Canada/AG/AI).
const PREFERRED_COUNTRY = {
    "1":  "US",
    "44": "UK",
    "33": "FR",
    "39": "IT",  // VA also uses +39 but Italy is far more common
    "47": "NO",
    "61": "AU",
    "64": "NZ",
};

let _SORTED_PREFIXES = null;
const sortedPrefixes = () => {
    if (_SORTED_PREFIXES) return _SORTED_PREFIXES;
    const seen = new Map(); // prefix -> ISO
    for (const [iso, mask] of PHONE_MASKS) {
        const pfx = dialPrefixFromMask(mask);
        if (!pfx) continue;
        if (PREFERRED_COUNTRY[pfx]) {
            seen.set(pfx, PREFERRED_COUNTRY[pfx]);
        } else if (!seen.has(pfx)) {
            seen.set(pfx, iso);
        }
    }
    _SORTED_PREFIXES = Array.from(seen.entries()).sort((a, b) => b[0].length - a[0].length);
    return _SORTED_PREFIXES;
};

const matchCountryByPrefix = (digits) => {
    for (const [pfx, iso] of sortedPrefixes()) {
        if (digits.startsWith(pfx)) return { country: iso, prefix: pfx };
    }
    return null;
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
                                                    onTermsClick,
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
        <Tooltip title={usernameSyntaxError.length > 0 ? "WARNING: The username has a syntax error.": pendingUsernameValidation ? "WAIT: The system look for an existing account with this username.": usernameAvailable ? "SUCCESS: The username is available.": "INFO: You can recover this account with manually entering the proper seed."}>
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
            <FormControlLabel
                className={classes.termsRow}
                onClick={onTermsClick}
                control={
                    <Checkbox
                        checked={termsAccepted}
                        onChange={() => {}}
                        name="terms-agreement"
                    />
                }
                label={t("components.create_account_dialog.i_have_read_the_terms_of_use_and")}
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
                        placeholder={seed.length > 0 ? "": readOnly ? "Write down the old seed phrase": "Generate a new seed phrase"}
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
                        <span className={"capLabel"}>{"Account still available"}</span>
                    </div>
                    {remainMs !== null && (
                        <div className={"capCol capRight"}>
                            <span className={"capValue"}>{fmtRemain(remainMs)}</span>
                            <span className={"capLabel"}>{`Until +${capacity.refill_amount || 250} refill`}</span>
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
            const name = (regionNames && regionNames.of(iso === "UK" ? "GB" : iso === "AC" ? "SH" : iso)) || iso;
            // Lower-cased once here: the filter below used to lower-case every
            // name and iso again on every keystroke (~240 entries × 2).
            return { iso, code, name, lname: name.toLowerCase(), liso: iso.toLowerCase() };
        });
        return named.sort((a, b) => a.name.localeCompare(b.name));
    }, [regionNames]);
    const filteredEntries = useMemo(() => {
        const q = pickerFilter.trim().toLowerCase();
        if (!q) return pickerEntries;
        const qDigits = q.replace(/\D/g, "");
        return pickerEntries.filter((e) =>
            e.lname.indexOf(q) !== -1 ||
            e.liso === q ||
            (qDigits.length > 0 && e.code.indexOf(qDigits) === 0)
        );
    }, [pickerEntries, pickerFilter]);
    // Stable: were re-created per render, which also forced every memo'd
    // CountryPickerRow below to re-render on each filter keystroke.
    const openPicker = useCallback(() => { setPickerFilter(""); setPickerOpen(true); }, []);
    const closePicker = useCallback(() => setPickerOpen(false), []);
    const selectCountry = useCallback((iso) => {
        setPickerOpen(false);
        if (onCountrySelect) onCountrySelect(iso);
    }, [onCountrySelect]);
    const onPickerFilterChange = useCallback((e) => setPickerFilter(e.target.value), []);
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
                    enoughSeed: !enoughSeed && " — expected 12, 15, 18, 21 or 24."
                })}</Typography>
                <div style={ST_TA_RIGHT}>
                    <Button
                        variant="contained"
                        color="default"
                        onClick={onVerifyRecovery}
                        disabled={!enoughSeed || recoveryStatus === "pending" || recoveryStatus === "ok"}
                    >
                        {recoveryStatus === "pending" ? "VERIFYING..." :
                            recoveryStatus === "ok"      ? "VERIFIED" :
                                "VERIFY SEED"}
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
    const countryUnsupported = destSupport(dialCode) === "unsupported";
    const sendDisabled = sendingCode || phoneRaw.length < 4 || resendInSec > 0 || noCapacity || blockedByCheck || sendLockedByWindow || countryUnsupported;
    // One-line status under the phone field, fed by /check-phone.
    let phoneNote = "";
    if (countryUnsupported) {
        phoneNote = "SMS verification is not yet available for this country.";
    } else if (phoneChecking) {
        phoneNote = "Checking number…";
    } else if (phoneCheck) {
        const nextAt = phoneCheck.next_send_allowed_at
            ? new Date(phoneCheck.next_send_allowed_at).toLocaleString(getLocaleCode())
            : null;
        if (phoneCheck.phone_status === "consumed" || phoneCheck.phone_status === "pending_creation") {
            phoneNote = "This phone number has already been used to create an account.";
        } else if (phoneCheck.phone_status === "send_limit_reached") {
            phoneNote = `This number has reached the maximum of ${phoneCheck.sends_max_total} verification SMS.`;
        } else if (phoneCheck.phone_status === "cooldown") {
            phoneNote = nextAt
                ? `An SMS was already sent to this number. The next one is possible on ${nextAt}.`
                : "An SMS was already sent to this number recently.";
        } else if (phoneCheck.phone_status === "verified") {
            phoneNote = "This phone is already verified — you can continue.";
        }
    }
    const verifyDisabled =
        codeStatus === "pending" ||
        codeStatus === "ok" ||
        confirmationCode.replace(/-/g, "").length < 6;

    const codeEndAdornment = (
        <InputAdornment position="end" className={classes.inputEndAdornment}>
            {codeStatus === "ok" ? (
                <Tooltip title={t("components.create_account_dialog.code_verified")}>
                    <IconButton edge="end" disabled>
                        <CheckCircleOutlineIcon style={ST_C_FFFFFF} />
                    </IconButton>
                </Tooltip>
            ) : codeStatus === "pending" ? (
                <CircularProgress size={20} color="inherit" />
            ) : (
                <Tooltip title={t("components.create_account_dialog.verify_the_confirmation_code")}>
                    <span>
                        <IconButton edge="end" onClick={onVerifyCode} disabled={verifyDisabled}>
                            <CheckCircleOutlineIcon />
                        </IconButton>
                    </span>
                </Tooltip>
            )}
        </InputAdornment>
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
            <Button
                fullWidth
                variant="contained"
                color="default"
                onClick={onSendCode}
                disabled={sendDisabled}
                startIcon={sendingCode ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                style={ST_MB_16}
            >
                {sendingCode ? "SENDING..." :
                    resendInSec > 0 ? t("components.create_account_dialog.resend_in_s", {
                            resendInSec: resendInSec
                        }) :
                        codeSent ? "RESEND CONFIRMATION CODE" : "SEND CONFIRMATION CODE"}
            </Button>
            {capacity && (
                <Typography style={ST_FS_12__MT_NEG8__MB_8}>
                    {noCapacity
                        ? t(
                            "components.create_account_dialog.daily_capacity_reached_new_account_slots_open",
                            {
                                toLocaleTimeString: capacity.next_refill_at ? new Date(capacity.next_refill_at).toLocaleString(getLocaleCode()) : "the next UTC midnight"
                            }
                        )
                        : t("components.create_account_dialog.account_slot_available_today", {
                            account_slot: { account_slot: capacity.accounts_available },
                        })}
                </Typography>
            )}
            <Collapse in={Boolean(phoneNote) && !sendError}>
                <Typography style={{ fontSize: 13, marginTop: -8, marginBottom: 12, color: phoneCheck && phoneCheck.phone_status === "verified" ? "#ffffff" : "#bdbdbd", fontStyle: "italic", textAlign: "left" }}>
                    {phoneNote}
                </Typography>
            </Collapse>
            <Collapse in={Boolean(sendError)}>
                <Typography style={ST_FS_14__MB_12__C_BDBDBD}>
                    {sendError}
                </Typography>
            </Collapse>
            <Collapse in={codeSent}>
                <FormControl variant="outlined" fullWidth style={ST_MT_8}>
                    <InputLabel htmlFor="confirmation-code-input">{t("components.create_account_dialog.confirmation_code")}</InputLabel>
                    <OutlinedInput
                        id="confirmation-code-input"
                        value={confirmationCode}
                        onChange={onCodeChange}
                        placeholder="ABC-123"
                        endAdornment={codeEndAdornment}
                        labelWidth={140}
                        inputProps={{
                            autoCapitalize: "characters",
                            autoComplete: "one-time-code",
                            autoCorrect: "off",
                            spellCheck: false,
                            maxLength: 7,
                            style: { letterSpacing: "0.2em", textTransform: "uppercase" },
                        }}
                    />
                </FormControl>
                <Collapse in={codeStatus === "fail"}>
                    <Typography style={ST_FS_14__MT_12__C_BDBDBD}>
                        {codeError || "That code doesn't match. Double-check the SMS or send a new one."}
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
                <DialogTitle>{"Select your country"}</DialogTitle>
                <DialogContent style={ST_PT_0}>
                    <FormControl fullWidth variant="outlined">
                        <OutlinedInput
                            autoFocus
                            value={pickerFilter}
                            onChange={onPickerFilterChange}
                            placeholder={"Search country or code"}
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
                                {"No country matches your search."}
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
//   Awareness panel + creation/recovery progress + backup download + auto-close.
// ─────────────────────────────────────────────────────────────────────────────
const StepConfirm = memo(function StepConfirm({
                                                  classes,
                                                  status,           // 'working' | 'success' | 'error'
                                                  recoveryMode,
                                                  errorMessage,
                                                  autoCloseInSec,
                                                  pdfDownloaded,
                                                  hasPdfBlob,
                                                  onDownloadPdf,
                                              }) {
    useLanguage();
    return (
        <DialogContent key={"view-3"}>
            <div className={classes.statusPanel}>
                {status === "working" && (
                    <>
                        <CircularProgress color="inherit" />
                        <Typography style={ST_C_BDBDBD__FS_14__TA_CENTER}>
                            {recoveryMode ? "Recovering your account..." : "Creating your account on Pixa..."}
                        </Typography>
                    </>
                )}
                {status === "success" && (
                    <>
                        <CheckCircleOutlineIcon className={classes.statusIconSuccess} />
                        <Typography style={ST_C_FFF__FS_16__TA_CENTER}>
                            {recoveryMode ? "Account recovered. You're signed in." : "Account created. You're signed in."}
                        </Typography>

                        {hasPdfBlob && (
                            <Button
                                variant={pdfDownloaded ? "outlined" : "contained"}
                                color="default"
                                onClick={onDownloadPdf}
                                style={ST_MT_8}
                            >
                                {pdfDownloaded ? "DOWNLOAD AGAIN" : "DOWNLOAD BACKUP PDF"}
                            </Button>
                        )}

                        {!pdfDownloaded && hasPdfBlob && (
                            <Typography style={ST_C_BDBDBD__FS_13__TA_CENTER}>
                                {t(
                                    "components.create_account_dialog.you_must_download_your_backup_pdf_before"
                                )}
                            </Typography>
                        )}

                        {pdfDownloaded && typeof autoCloseInSec === "number" && autoCloseInSec > 0 && (
                            <Typography style={ST_C_7B7B7B__FS_13__TA_CENTER}>{t("components.create_account_dialog.this_dialog_will_close_in_s", {
                                autoCloseInSec: autoCloseInSec
                            })}</Typography>
                        )}
                    </>
                )}
                {status === "error" && (
                    <Typography style={ST_C_BDBDBD__FSTY_ITALIC__FS_14}>
                        {errorMessage || "Something went wrong. Please try again."}
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
        this._autoCloseTimer = null;
        this._countdownTimer = null;
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
            _pdfDownloaded: false,         // user has actually clicked download
            _creating_account: false,
            _fullscreen: (window.innerWidth || document.documentElement.clientWidth || (document.body || document.getElementsByTagName('body')[0]).clientWidth) <= 960,
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
            _autoCloseInSec: null,
        };
    };

    componentDidMount() {
        window.addEventListener("resize", this._computeSize);
        this._fetchCapacity();
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
        window.removeEventListener("resize", this._computeSize);
        if (window.visualViewport) {
            window.visualViewport.removeEventListener("resize", this._updateVisualViewport);
            window.visualViewport.removeEventListener("scroll", this._updateVisualViewport);
        }
        document.documentElement.style.removeProperty("--cad-vvh");
        document.documentElement.style.removeProperty("--cad-vvt");
        if (this._autoCloseTimer)     { clearTimeout(this._autoCloseTimer);     this._autoCloseTimer = null; }
        if (this._countdownTimer)     { clearInterval(this._countdownTimer);    this._countdownTimer = null; }
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
        const fullscreen = (window.innerWidth || document.documentElement.clientWidth || (document.body || document.getElementsByTagName('body')[0]).clientWidth) <= 960;
        if (this.state._fullscreen !== fullscreen) {
            this.setState({_fullscreen: fullscreen}, () => { this.forceUpdate(); });
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
                _pdfDownloaded: false,     // user has NOT saved the file yet
            }, () => this.forceUpdate());
        } catch (err) {
            console.error("[CreateAccountDialog] silent key generation failed:", err);
            if (actions?.trigger_snackbar) {
                actions.trigger_snackbar(t("components.create_account_dialog.could_not_prepare_your_account_keys"), "error");
            }
        }
    };

    /**
     * Save the previously-built PDF blob to disk and mark it as downloaded.
     * Called from the step 2 success state via the explicit "Download backup"
     * button. The user must download before the OK / auto-close can complete.
     */
    _trigger_pdf_download = () => {
        const { _pdfBlob, _username } = this.state;
        if (!_pdfBlob) return;
        try {
            const url = URL.createObjectURL(_pdfBlob);
            const a = document.createElement("a");
            a.download = `KeysOf-${_username}-Pixagram.pdf`;
            a.href = url;
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            this.setState({ _pdfDownloaded: true }, () => {
                this.forceUpdate(() => {
                    // The auto-close timer is gated on the PDF being downloaded;
                    // start it now if we're already in success state.
                    if (this.state._confirmStatus === "success" && !this._autoCloseTimer) {
                        this._startAutoClose();
                    }
                });
            });
        } catch (err) {
            console.error("[CreateAccountDialog] PDF download failed:", err);
        }
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
     * Terms & Conditions row (step 0). A click anywhere on the row — checkbox
     * or label — toggles the agreement AND opens the terms modal.
     * preventDefault stops the native checkbox toggle so the controlled state
     * stays the single source of truth (no double flip on label clicks).
     */
    _handleTermsClick = (e) => {
        if (e && typeof e.preventDefault === "function") e.preventDefault();
        this.setState({
            _termsAccepted: !this.state._termsAccepted,
            _termsModalOpen: true,
        }, () => this.forceUpdate());
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
     */
    _handleCountrySelect = (iso) => {
        const prefix = dialCodeFor(iso);
        if (!prefix) return;
        this.setState({
            _country: iso,
            _dialCode: "+" + prefix,
            _phoneMask: pickSubscriberMask(iso, this.state._phoneRaw.length) || "",
            _phoneFormatted: formatSubscriber(this.state._phoneRaw, iso),
            _codeSent: false,
            _confirmationCode: "",
            _codeStatus: "idle",
            _phoneCheck: null,
            _sendError: "",
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
     *  - If the pasted/typed value starts with "+", treat it as a full
     *    international number and re-route the leading country code to
     *    `_dialCode` so we never duplicate the prefix.
     *  - If the user typed the bare country dial code at the start (e.g. "41..."
     *    in CH), strip it.
     *  - If the digits would overflow the country's mask AND begin with a "0",
     *    strip the leading "0" — this is the European/Swiss/etc. trunk prefix
     *    that callers use domestically but is dropped in the international
     *    representation. So "076 429 49 80" -> "76 429 49 80".
     *  - Hard-cap at the mask's slot count so typing extra digits is rejected
     *    rather than truncating from the END (which would lose the new digit).
     *  - When the formatted value would be LONGER than the user's current
     *    input, the user just deleted a separator — pop a digit so the field
     *    never feels "stuck" on the same character.
     */
    _handlePhoneChange = (e) => {
        const inputVal = String(e.target.value || "");
        const trimmed = inputVal.trim();
        const { _country, _dialCode } = this.state;

        // Detect a leading "+..." (paste or manual full-number entry).
        if (trimmed.startsWith("+")) {
            const allDigits = trimmed.replace(/\D/g, "");
            const match = matchCountryByPrefix(allDigits);
            if (match) {
                let subscriber = allDigits.slice(match.prefix.length);
                const country = match.country;
                // Strip leading "0" (trunk prefix).
                subscriber = subscriber.replace(/^0+/, "");
                const maxSlots = ((pickSubscriberMask(country, 64) || "").match(/#/g) || []).length;
                if (maxSlots > 0 && subscriber.length > maxSlots) subscriber = subscriber.slice(0, maxSlots);

                this.setState({
                    _country: country,
                    _dialCode: "+" + match.prefix,
                    _phoneRaw: subscriber,
                    _phoneFormatted: formatSubscriber(subscriber, country),
                    _phoneMask: pickSubscriberMask(country, subscriber.length) || "",
                    _codeSent: false,
                    _confirmationCode: "",
                    _codeStatus: "idle",
                    _phoneCheck: null,
                    _sendError: "",
                }, () => { this.forceUpdate(); this._schedulePhoneCheck(); });
                return;
            }
        }

        let digits = trimmed.replace(/\D/g, "");

        // Tolerate users typing the country code without "+": if digits start
        // with the current country's dial code AND they typed more than that,
        // assume they retyped the prefix and strip it.
        const dialDigits = (_dialCode || "").replace(/\D/g, "");
        if (dialDigits && digits.startsWith(dialDigits) && digits.length > dialDigits.length) {
            digits = digits.slice(dialDigits.length);
        }

        // Strip leading "0" (trunk prefix). In European/most national dialing
        // plans, the leading 0 is dialed domestically but is never part of the
        // international subscriber number. None of our subscriber masks start
        // with a literal 0, so this is safe across countries.
        digits = digits.replace(/^0+/, "");

        // Mask slot count for the active country (use a generous probe so we
        // pick the LONGEST mask among the country's options).
        const maxSlots = ((pickSubscriberMask(_country, 64) || "").match(/#/g) || []).length;

        // Hard cap so extra typing doesn't shift digits off the end.
        if (maxSlots > 0 && digits.length > maxSlots) {
            digits = digits.slice(0, maxSlots);
        }

        // Separator-deletion detection: if the user kept the same number of
        // digits but shortened the field, they deleted a separator character
        // — pop a trailing digit so progress visibly happens.
        const prevDigits = String(this.state._phoneRaw || "");
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
            _codeSent: false,
            _confirmationCode: "",
            _codeStatus: "idle",
            _phoneCheck: null,
            _sendError: "",
        }, () => { this.forceUpdate(); this._schedulePhoneCheck(); });
    };

    /**
     * Paste handler — explicit so we can robustly trim whitespace and detect
     * "+..." prefixes from browser autofill suggestions. We intercept the
     * paste, normalise, and apply it; the synthetic onChange in some browsers
     * would otherwise fire with the raw clipboard text.
     */
    _handlePhonePaste = (e) => {
        try {
            const txt = (e.clipboardData || window.clipboardData)?.getData("text") || "";
            if (!txt) return;
            e.preventDefault();
            this._handlePhoneChange({ target: { value: txt.trim() } });
        } catch (_) {
            // Fall through — let the default paste happen and onChange catch it.
        }
    };

    _handleCodeChange = (e) => {
        const formatted = formatConfirmationCode(e.target.value);
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
     *   - 429 + retry_after: resend cooldown — mirrored on the button.
     */
    _sendCode = async () => {
        const { _phoneRaw, _dialCode } = this.state;
        const phone = composeE164(_dialCode, _phoneRaw);
        this.setState({ _sendingCode: true, _codeStatus: "idle", _sendError: "", _codeError: "" }, () => this.forceUpdate());
        try {
            const res = await fetch(`${ACCOUNT_SERVICE_API}/send-code`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ phone, language: toSmsLang(getLanguage()) }),
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
                        _sendError: "This phone is already verified. Finish sign-up in the session where you verified it, or retry after that verification expires.",
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

            let msg = json.error || "Could not send the confirmation code. Try again.";
            if (json.code === "SEND_WINDOW") {
                // 1 SMS per 7-day window: a ticking countdown makes no sense
                // at this scale — show the date and lock the button until then.
                const when = json.next_send_allowed_at
                    ? new Date(json.next_send_allowed_at).toLocaleString(getLocaleCode())
                    : null;
                msg = when
                    ? `An SMS was already sent to this number. The next one is possible on ${when}.`
                    : (json.error || "An SMS was already sent to this number recently.");
                this.setState({ _nextSendAllowedAt: json.next_send_allowed_at || null }, () => this.forceUpdate());
                if (typeof json.retry_after === "number" && json.retry_after <= 300) {
                    this._startResendCountdown(json.retry_after);
                }
            } else if (json.code === "COUNTRY_NOT_SUPPORTED" || json.code === "COUNTRY_NOT_ENABLED" || json.code === "SENDER_NOT_AVAILABLE") {
                msg = json.error || "SMS verification is not yet available for this country.";
            } else if (json.code === "IP_LIMIT") {
                msg = json.error || "Too many verification requests from your network. Try again later.";
                if (typeof json.retry_after === "number" && json.retry_after <= 300) {
                    this._startResendCountdown(json.retry_after);
                }
            } else if (json.code === "SEND_LIMIT_TOTAL") {
                msg = `This phone number has reached the maximum of ${json.sends_max_total || 2} verification SMS and cannot receive more.`;
            } else if (res.status === 429 && json.retry_after) {
                this._startResendCountdown(json.retry_after);
                msg = t(
                    "components.create_account_dialog.please_wait_s_before_requesting_another_code",
                    {
                        retry_after: json.retry_after
                    }
                );
            } else if (res.status === 403) {
                msg = json.error || "This phone number has already been used to create an account.";
            } else if (res.status === 400) {
                msg = json.error || "That phone number doesn't look valid.";
            }
            this.setState({ _sendingCode: false, _sendError: msg }, () => this.forceUpdate());
            if (actions?.trigger_snackbar) actions.trigger_snackbar(msg, "error");
        } catch (err) {
            this.setState({ _sendingCode: false, _sendError: "Network error — could not reach the account service." }, () => this.forceUpdate());
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

            let msg = json.error || "That code doesn't match. Double-check the SMS or send a new one.";
            if (res.status === 401 && typeof json.attempts_remaining === "number") {
                msg = t(
                    "components.create_account_dialog.that_code_doesnt_match_attempt_left_before",
                    {
                        attempt: { attempt: json.attempts_remaining },
                    }
                );
            } else if (res.status === 410) {
                msg = "That code expired — send a new one.";
            } else if (res.status === 429) {
                msg = json.error || "Too many attempts — request a new code.";
            } else if (res.status === 409) {
                msg = "This phone is already verified from another session. Finish there, or retry after that verification expires.";
            } else if (res.status === 403) {
                msg = json.error || "This phone number has already been used to create an account.";
            } else if (res.status === 404) {
                msg = "No verification in progress for this number — send a code first.";
            } else if (res.status === 500) {
                msg = "Verification hiccuped on the server — send a fresh code and try again.";
            }
            this.setState({ _codeStatus: "fail", _codeError: msg }, () => this.forceUpdate());
        } catch (err) {
            this.setState({ _codeStatus: "fail", _codeError: "Network error — could not reach the account service." }, () => this.forceUpdate());
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
                    _pdfDownloaded:  false,
                }, () => this.forceUpdate());
            } else {
                this.setState({ _recoveryStatus: "fail" }, () => this.forceUpdate());
            }
        } catch (err) {
            this.setState({ _recoveryStatus: "fail" }, () => this.forceUpdate());
        }
    };

    // ── Auto-login after creation/recovery ──────────────────────────────────
    //
    // Mirrors the master-password / no-PIN path in LoginDialog so the user is
    // logged in exactly as if they had typed their master password into the
    // login dialog. Specifically:
    //
    //   1. api.updateConfig({ SESSION_TIMEOUT, PIN_TIMEOUT }) — applies the
    //      1-day timeout to the session manager's config.
    //   2. api.quickLogin(username, masterKey, 'master', { stayConnected: true })
    //      — derives all role keys from the master password, creates the
    //      session with the derived keys, marks login_type='master', emits
    //      the session_created event listeners care about, and persists.
    //
    // The previous version passed pre-derived private keys to createSession
    // directly. That technically created a session record but bypassed
    // keyManager.addAccountWithMasterKey, so consumers expecting the master-
    // key derivation chain (e.g. on-demand role-key recovery) would break.
    _loginCurrentAccount = async () => {
        const { api, _username, _masterKey } = this.state;
        const { onLogin } = this.props;

        if (!api || !_masterKey) {
            console.error("[CreateAccountDialog] auto-login: missing api or master key");
            return false;
        }

        const sessionTimeoutMs = SESSION_TIMEOUT_MIN * 60 * 1000;
        const pinTimeoutMs     = PIN_TIMEOUT_MIN     * 60 * 1000;

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

            // Step 2: quickLogin with the master password — same path
            // LoginDialog takes when no PIN is set. stayConnected:true makes
            // the session persistent (device-wrapped) for the timeout window.
            if (typeof api.quickLogin === "function") {
                const result = await api.quickLogin(_username, _masterKey, "master", {
                    skipValidation: true,
                    skipSession:    false,
                    stayConnected:  true,
                    userAgent:      (typeof navigator !== "undefined" && navigator.userAgent) || "unknown",
                });
                // quickLogin handles setActiveAccount internally on success.
                if (api.keyManager?.setActiveAccount) {
                    try { api.keyManager.setActiveAccount(_username); } catch (_) {}
                }
                // If for any reason no session was emitted, fall back to a
                // direct createSession call with derived keys.
                const sessionEmitted = result && (result.sessionId || result.eventEmitted);
                if (!sessionEmitted && api.sessionManager?.createSession) {
                    let derivedKeys = null;
                    if (api.keyManager?.addAccountWithMasterKey) {
                        try {
                            derivedKeys = await api.keyManager.addAccountWithMasterKey(
                                _username, _masterKey, { storeInVault: false }
                            );
                        } catch (e) {
                            console.warn("[CreateAccountDialog] addAccountWithMasterKey fallback failed:", e);
                        }
                    }
                    await api.sessionManager.createSession(_username, {
                        keys:           derivedKeys || this.state._privateKeys,
                        persistent:     true,
                        timeout_ms:     sessionTimeoutMs,
                        pin_timeout_ms: pinTimeoutMs,
                        login_type:     "master",
                        user_agent:     (typeof navigator !== "undefined" && navigator.userAgent) || "unknown",
                    });
                }
            } else if (api.sessionManager?.createSession) {
                // No quickLogin available — derive then create session manually.
                let derivedKeys = null;
                if (api.keyManager?.addAccountWithMasterKey) {
                    derivedKeys = await api.keyManager.addAccountWithMasterKey(
                        _username, _masterKey, { storeInVault: false }
                    );
                }
                await api.sessionManager.createSession(_username, {
                    keys:           derivedKeys || this.state._privateKeys,
                    persistent:     true,
                    timeout_ms:     sessionTimeoutMs,
                    pin_timeout_ms: pinTimeoutMs,
                    login_type:     "master",
                    user_agent:     (typeof navigator !== "undefined" && navigator.userAgent) || "unknown",
                });
                if (api.keyManager?.setActiveAccount) {
                    try { api.keyManager.setActiveAccount(_username); } catch (_) {}
                }
            } else if (api.eventEmitter?.emit) {
                // Last-resort: just emit so any listening UI updates.
                api.eventEmitter.emit("session_created", { account: _username });
            }

            // Offer the browser the master password for "save password?"
            // prompt — same single-credential pattern LoginDialog autofills against.
            this._triggerCredentialSave(_username, _masterKey);

            if (typeof onLogin === "function") {
                onLogin({ username: _username, autoFromCreation: true });
            }
            return true;
        } catch (err) {
            console.error("[CreateAccountDialog] auto-login failed:", err);
            return false;
        }
    };

    // ── Auto-close after success ────────────────────────────────────────────
    _startAutoClose = () => {
        if (this._autoCloseTimer) clearTimeout(this._autoCloseTimer);
        if (this._countdownTimer) clearInterval(this._countdownTimer);
        const totalSec = Math.round(AUTO_CLOSE_MS / 1000);
        this.setState({ _autoCloseInSec: totalSec }, () => this.forceUpdate());
        this._countdownTimer = setInterval(() => {
            const next = (this.state._autoCloseInSec || 0) - 1;
            this.setState({ _autoCloseInSec: next > 0 ? next : 0 }, () => this.forceUpdate());
        }, 1000);
        this._autoCloseTimer = setTimeout(() => {
            if (this._countdownTimer) { clearInterval(this._countdownTimer); this._countdownTimer = null; }
            this._handleDialogClose();
        }, AUTO_CLOSE_MS);
    };

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
            const errorMsg = "Public keys not found. Please download the sprout PDF first.";
            this.setState({ _confirmStatus: "error", _errorMessage: errorMsg }, () => this.forceUpdate());
            if (actions?.trigger_snackbar) actions.trigger_snackbar(errorMsg, "error");
            return;
        }

        if (!_voucher) {
            const errorMsg = "Phone verification voucher missing. Go back and verify your phone again.";
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
                // Auto-login the freshly-created account (1-day session).
                await this._loginCurrentAccount();

                this.setState({
                    _creating_account: false,
                    _confirmStatus:    "success",
                }, () => this.forceUpdate(() => {
                    // Only start the auto-close countdown if the user has
                    // already saved their backup PDF; otherwise wait until
                    // they click the Download button on the success panel.
                    if (this.state._pdfDownloaded) this._startAutoClose();
                }));

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
                    error: result.error || "Unknown error"
                });
                if (status === 410 || (status === 403 && result.field === "voucher")) {
                    errorMsg = "Your phone verification expired. Go back and verify your phone again.";
                    this.setState({
                        _voucher: null, _voucherExpiresAt: null,
                        _codeStatus: "idle", _codeSent: false, _confirmationCode: "",
                    }, () => this.forceUpdate());
                } else if (status === 409 && result.field === "voucher") {
                    errorMsg = result.used_at
                        ? "This phone verification was already used to create an account."
                        : "An account creation with this verification is already in flight — give it a minute, then try again.";
                } else if (status === 409) {
                    errorMsg = `@${_username.toLowerCase()} was just taken on-chain. Go back and pick another name — your phone verification is still valid.`;
                } else if (status === 429) {
                    const when = result.next_refill_at ? new Date(result.next_refill_at).toLocaleString(getLocaleCode()) : "the next UTC midnight";
                    errorMsg = `Account-creation capacity is exhausted for now. New slots open at ${when} — your phone verification stays valid.`;
                    this._fetchCapacity();
                } else if (status === 402 || status === 500 || status === 503) {
                    errorMsg = `${result.error || "The network broadcast failed."} Your phone verification is still valid — go back and try again in a moment.`;
                }
                this.setState({ _creating_account: false, _confirmStatus: "error", _errorMessage: errorMsg }, () => this.forceUpdate());
                if (actions?.trigger_snackbar) actions.trigger_snackbar(errorMsg, "error");
            }
        } catch (error) {
            const errorMsg = t("components.create_account_dialog.account_creation_failed_2", {
                message: error.message || "Unknown error"
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
        const ok = await this._loginCurrentAccount();
        if (ok) {
            this.setState({ _confirmStatus: "success" }, () => this.forceUpdate(() => {
                if (this.state._pdfDownloaded) this._startAutoClose();
            }));
            if (actions?.trigger_snackbar) {
                actions.trigger_snackbar(t("components.create_account_dialog.welcome_back", {
                    _username: this.state._username
                }), "success");
            }
        } else {
            const errorMsg = "Could not start a session. Please try again.";
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
        // Step 2 OK button: route through the unified close handler so the
        // PDF-must-be-downloaded gate (and timer cleanup) are honored.
        if (this.state._confirmStatus === "success") {
            this._handleDialogClose();
        }
    };

    /**
     * Universal close handler.
     *
     *  - While creating/recovering: block close entirely. Backdrop clicks and
     *    Escape do nothing during the on-chain transaction.
     *  - On step 2 success with an undownloaded PDF: trigger the download
     *    automatically before closing. This satisfies the "must download"
     *    requirement without making the user feel trapped.
     *  - Otherwise: pass through to props.onClose.
     */
    _handleDialogClose = (event, reason) => {
        const { _creating_account, _confirmStatus, _pdfBlob, _pdfDownloaded } = this.state;

        // Hard block: never close mid-creation.
        if (_creating_account || _confirmStatus === "working") return;

        // On step 2 success: force-download the PDF before allowing close.
        if (_confirmStatus === "success" && _pdfBlob && !_pdfDownloaded) {
            this._trigger_pdf_download();
            // Fall through and close after the download is triggered. The
            // download itself is async (browser save dialog), but the click
            // dispatch is sync, so the file save proceeds independently.
        }

        if (this._autoCloseTimer)    { clearTimeout(this._autoCloseTimer);    this._autoCloseTimer = null; }
        if (this._countdownTimer)    { clearInterval(this._countdownTimer);   this._countdownTimer = null; }
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
        if (_pending_username_validation) return "Pending validation";
        if (!_username_available) {
            return _recoveryMode
                ? "Recovery mode: enter your seed phrase below to take this account back"
                : "Username already taken";
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
            _codeError,
            _resendInSec,
            _capacity,
            _phoneCheck,
            _phoneChecking,
            _nextSendAllowedAt,
            _recoveryStatus,
            _confirmStatus,
            _errorMessage,
            _autoCloseInSec,
            _pdfBlob,
            _pdfDownloaded,
        } = this.state;

        const username_message = this._get_username_message();

        return (
            <React.Fragment>
                <Dialog className={classes.dialog}
                        open={open}
                        fullScreen={_fullscreen}
                        fullWidth={true}
                        maxWidth={"md"}
                        disablePortal={false}
                        disableBackdropClick={_creating_account || _confirmStatus === "working"}
                        disableEscapeKeyDown={_creating_account || _confirmStatus === "working"}
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
                                    <Stepper activeStep={_tab_value} style={ST_P_24PX}>
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
                                            onTermsClick={this._handleTermsClick}
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
                                            autoCloseInSec={_autoCloseInSec}
                                            pdfDownloaded={_pdfDownloaded}
                                            hasPdfBlob={Boolean(_pdfBlob)}
                                            onDownloadPdf={this._trigger_pdf_download}
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
                                        <Button variant="contained" color="primary" onClick={this._handleDialogClose} disabled={_creating_account}>{"CANCEL"}</Button>
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
                                            {_recoveryMode ? "RECOVER" : "NEXT"}
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
                                        <Button
                                            className={classes.whiteButton}
                                            variant="contained"
                                            color="primary"
                                            autoFocus
                                            onClick={this._handleFinalConfirm}
                                            disabled={_confirmStatus !== "success" || !_pdfDownloaded}
                                        >
                                            OK
                                        </Button>
                                    )}
                                </DialogActions>
                            </Fade>
                        </div>
                    </div>
                </Dialog>
                {/* Terms of Use / Privacy Policy modal — opened by any click on
                    the step-0 agreement checkbox or its label. Renders the same
                    two components as AppInfoDialog (strings in locales/en.js
                    under components.terms_of_use / components.privacy_policy). */}
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