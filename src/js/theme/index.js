import {createTheme} from "@material-ui/core/styles";

import {palette} from "./lightPalette";
import {overrides} from "./overrides";
import {typography} from "./typography";


export const lightTheme = createTheme({
    palette,
    overrides,
    typography
});