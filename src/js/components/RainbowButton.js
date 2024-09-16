import * as React from "preact/compat";
import PropTypes from 'prop-types';
import clsx from 'clsx';
import withStyles from '@material-ui/styles/withStyles';
import { alpha } from '@material-ui/core/styles/colorManipulator';
import ButtonBase from '@material-ui/core/ButtonBase';
import capitalize from '@material-ui/core/utils/capitalize';

export const styles = (theme) => ({
    /* Styles applied to the root element. */
    root: {
        ...theme.typography.button,
        boxSizing: 'border-box',
        minWidth: 64,
        padding: '6px 16px',
        borderRadius: theme.shape.borderRadius,
        color: theme.palette.text.primary,
        transition: theme.transitions.create(['background-color', 'box-shadow', 'border'], {
            duration: theme.transitions.duration.short,
        }),
        '&:hover': {
            textDecoration: 'none',
            backgroundColor: alpha(theme.palette.text.primary, theme.palette.action.hoverOpacity),
            '@media (hover: none)': {
                backgroundColor: 'transparent',
            },
            '&$disabled': {
                backgroundColor: 'transparent',
            },
        },
        '&$disabled': {
            color: theme.palette.action.disabled,
        },
        position: 'relative',
    },
    /* Styles applied to the span element that wraps the children. */
    label: {
        position: 'relative',
        zIndex: 1,
        width: '100%',
        display: 'inherit',
        alignItems: 'inherit',
        justifyContent: 'inherit',
    },
    /* Animated gradient border container */
    gradientBorder: {
        position: 'absolute',
        inset: -2,
        borderRadius: 'inherit',
        border: '2px solid transparent',
        pointerEvents: 'none',
        overflow: 'visible',
        mask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0) border-box',
        maskComposite: 'exclude',
        WebkitMaskComposite: 'xor',
        '&::after': {
            content: '""',
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '300%',
            height: '300%',
            transform: 'translate(-50%, -50%)',
            background: 'conic-gradient(from 0deg, hsl(0, 100%, 65%), hsl(60, 100%, 65%), hsl(120, 100%, 65%), hsl(180, 100%, 65%), hsl(240, 100%, 65%), hsl(300, 100%, 65%), hsl(360, 100%, 65%))',
            animation: '$spin 2s linear infinite',
            zIndex: -1,
        },
    },
    '@keyframes spin': {
        to: {
            transform: 'translate(-50%, -50%) rotate(360deg)',
        },
    },
    /* Styles applied to the root element if `variant="text"`. */
    text: {
        padding: '6px 8px',
    },
    /* Styles applied to the root element if `variant="text"` and `color="primary"`. */
    textPrimary: {
        color: theme.palette.primary.main,
        '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.hoverOpacity),
            '@media (hover: none)': {
                backgroundColor: 'transparent',
            },
        },
    },
    /* Styles applied to the root element if `variant="text"` and `color="secondary"`. */
    textSecondary: {
        color: theme.palette.secondary.main,
        '&:hover': {
            backgroundColor: alpha(theme.palette.secondary.main, theme.palette.action.hoverOpacity),
            '@media (hover: none)': {
                backgroundColor: 'transparent',
            },
        },
    },
    /* Styles applied to the root element if `variant="outlined"`. */
    outlined: {
        padding: '5px 15px',
        border: `1px solid ${
            theme.palette.type === 'light' ? 'rgba(0, 0, 0, 0.23)' : 'rgba(255, 255, 255, 0.23)'
        }`,
        '&$disabled': {
            border: `1px solid ${theme.palette.action.disabledBackground}`,
        },
    },
    /* Styles applied to the root element if `variant="outlined"` and `color="primary"`. */
    outlinedPrimary: {
        color: theme.palette.primary.main,
        border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
        '&:hover': {
            border: `1px solid ${theme.palette.primary.main}`,
            backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.hoverOpacity),
            '@media (hover: none)': {
                backgroundColor: 'transparent',
            },
        },
    },
    /* Styles applied to the root element if `variant="outlined"` and `color="secondary"`. */
    outlinedSecondary: {
        color: theme.palette.secondary.main,
        border: `1px solid ${alpha(theme.palette.secondary.main, 0.5)}`,
        '&:hover': {
            border: `1px solid ${theme.palette.secondary.main}`,
            backgroundColor: alpha(theme.palette.secondary.main, theme.palette.action.hoverOpacity),
            '@media (hover: none)': {
                backgroundColor: 'transparent',
            },
        },
        '&$disabled': {
            border: `1px solid ${theme.palette.action.disabled}`,
        },
    },
    /* Styles applied to the root element if `variant="contained"`. */
    contained: {
        color: theme.palette.getContrastText(theme.palette.grey[300]),
        backgroundColor: theme.palette.grey[300],
        boxShadow: theme.shadows[2],
        '&:hover': {
            backgroundColor: theme.palette.grey.A100,
            boxShadow: theme.shadows[4],
            '@media (hover: none)': {
                boxShadow: theme.shadows[2],
                backgroundColor: theme.palette.grey[300],
            },
            '&$disabled': {
                backgroundColor: theme.palette.action.disabledBackground,
            },
        },
        '&$focusVisible': {
            boxShadow: theme.shadows[6],
        },
        '&:active': {
            boxShadow: theme.shadows[8],
        },
        '&$disabled': {
            color: theme.palette.action.disabled,
            boxShadow: theme.shadows[0],
            backgroundColor: theme.palette.action.disabledBackground,
        },
    },
    /* Styles applied to the root element if `variant="contained"` and `color="primary"`. */
    containedPrimary: {
        color: theme.palette.primary.contrastText,
        backgroundColor: theme.palette.primary.main,
        '&:hover': {
            backgroundColor: theme.palette.primary.dark,
            '@media (hover: none)': {
                backgroundColor: theme.palette.primary.main,
            },
        },
    },
    /* Styles applied to the root element if `variant="contained"` and `color="secondary"`. */
    containedSecondary: {
        color: theme.palette.secondary.contrastText,
        backgroundColor: theme.palette.secondary.main,
        '&:hover': {
            backgroundColor: theme.palette.secondary.dark,
            '@media (hover: none)': {
                backgroundColor: theme.palette.secondary.main,
            },
        },
    },
    /* Styles applied to the root element if `disableElevation={true}`. */
    disableElevation: {
        boxShadow: 'none',
        '&:hover': {
            boxShadow: 'none',
        },
        '&$focusVisible': {
            boxShadow: 'none',
        },
        '&:active': {
            boxShadow: 'none',
        },
        '&$disabled': {
            boxShadow: 'none',
        },
    },
    /* Pseudo-class applied to the ButtonBase root element if the button is keyboard focused. */
    focusVisible: {},
    /* Pseudo-class applied to the root element if `disabled={true}`. */
    disabled: {},
    /* Styles applied to the root element if `color="inherit"`. */
    colorInherit: {
        color: 'inherit',
        borderColor: 'currentColor',
    },
    /* Styles applied to the root element if `size="small"` and `variant="text"`. */
    textSizeSmall: {
        padding: '4px 5px',
        fontSize: theme.typography.pxToRem(13),
    },
    /* Styles applied to the root element if `size="large"` and `variant="text"`. */
    textSizeLarge: {
        padding: '8px 11px',
        fontSize: theme.typography.pxToRem(15),
    },
    /* Styles applied to the root element if `size="small"` and `variant="outlined"`. */
    outlinedSizeSmall: {
        padding: '3px 9px',
        fontSize: theme.typography.pxToRem(13),
    },
    /* Styles applied to the root element if `size="large"` and `variant="outlined"`. */
    outlinedSizeLarge: {
        padding: '7px 21px',
        fontSize: theme.typography.pxToRem(15),
    },
    /* Styles applied to the root element if `size="small"` and `variant="contained"`. */
    containedSizeSmall: {
        padding: '4px 10px',
        fontSize: theme.typography.pxToRem(13),
    },
    /* Styles applied to the root element if `size="large"` and `variant="contained"`. */
    containedSizeLarge: {
        padding: '8px 22px',
        fontSize: theme.typography.pxToRem(15),
    },
    /* Styles applied to the root element if `size="small"`. */
    sizeSmall: {},
    /* Styles applied to the root element if `size="large"`. */
    sizeLarge: {},
    /* Styles applied to the root element if `fullWidth={true}`. */
    fullWidth: {
        width: '100%',
    },
    /* Styles applied to the startIcon element if supplied. */
    startIcon: {
        display: 'inherit',
        marginRight: 8,
        marginLeft: -4,
        '&$iconSizeSmall': {
            marginLeft: -2,
        },
    },
    /* Styles applied to the endIcon element if supplied. */
    endIcon: {
        display: 'inherit',
        marginRight: -4,
        marginLeft: 8,
        '&$iconSizeSmall': {
            marginRight: -2,
        },
    },
    /* Styles applied to the icon element if supplied and `size="small"`. */
    iconSizeSmall: {
        '& > *:first-child': {
            fontSize: 18,
        },
    },
    /* Styles applied to the icon element if supplied and `size="medium"`. */
    iconSizeMedium: {
        '& > *:first-child': {
            fontSize: 20,
        },
    },
    /* Styles applied to the icon element if supplied and `size="large"`. */
    iconSizeLarge: {
        '& > *:first-child': {
            fontSize: 22,
        },
    },
});

const Button = React.forwardRef(function Button(props, ref) {
    const {
        children,
        classes,
        className,
        color = 'default',
        component = 'button',
        disabled = false,
        disableElevation = false,
        disableFocusRipple = false,
        endIcon: endIconProp,
        focusVisibleClassName,
        fullWidth = false,
        size = 'medium',
        startIcon: startIconProp,
        type = 'button',
        variant = 'text',
        ...other
    } = props;

    const startIcon = startIconProp && (
        <span className={clsx(classes.startIcon, classes[`iconSize${capitalize(size)}`])}>
            {startIconProp}
        </span>
    );

    const endIcon = endIconProp && (
        <span className={clsx(classes.endIcon, classes[`iconSize${capitalize(size)}`])}>
            {endIconProp}
        </span>
    );

    return (
        <ButtonBase
            className={clsx(
                classes.root,
                classes[variant],
                {
                    [classes[`${variant}${capitalize(color)}`]]: color !== 'default' && color !== 'inherit',
                    [classes[`${variant}Size${capitalize(size)}`]]: size !== 'medium',
                    [classes[`size${capitalize(size)}`]]: size !== 'medium',
                    [classes.disableElevation]: disableElevation,
                    [classes.disabled]: disabled,
                    [classes.fullWidth]: fullWidth,
                    [classes.colorInherit]: color === 'inherit',
                },
                className,
            )}
            component={component}
            disabled={disabled}
            focusRipple={!disableFocusRipple}
            focusVisibleClassName={clsx(classes.focusVisible, focusVisibleClassName)}
            ref={ref}
            type={type}
            {...other}
        >
            <span className={classes.gradientBorder} />
            <span className={classes.label}>
                {startIcon}
                {children}
                {endIcon}
            </span>
        </ButtonBase>
    );
});

Button.propTypes = {
    children: PropTypes.node,
    classes: PropTypes.object,
    className: PropTypes.string,
    color: PropTypes.oneOf(['default', 'inherit', 'primary', 'secondary']),
    component: PropTypes.elementType,
    disabled: PropTypes.bool,
    disableElevation: PropTypes.bool,
    disableFocusRipple: PropTypes.bool,
    disableRipple: PropTypes.bool,
    endIcon: PropTypes.node,
    focusVisibleClassName: PropTypes.string,
    fullWidth: PropTypes.bool,
    href: PropTypes.string,
    size: PropTypes.oneOf(['large', 'medium', 'small']),
    startIcon: PropTypes.node,
    type: PropTypes.oneOfType([PropTypes.oneOf(['button', 'reset', 'submit']), PropTypes.string]),
    variant: PropTypes.oneOf(['contained', 'outlined', 'text']),
};

export default withStyles(styles, { name: 'MuiButton' })(Button);