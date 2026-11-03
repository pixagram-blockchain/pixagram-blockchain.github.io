import {createTheme} from "@material-ui/core/styles";

import {palette} from "./lightPalette";
import {overrides} from "./overrides";
import {props} from "./props";
import {typography} from "./typography";


export const lightTheme = createTheme({
    palette,
    overrides,
    props,
    typography
});
