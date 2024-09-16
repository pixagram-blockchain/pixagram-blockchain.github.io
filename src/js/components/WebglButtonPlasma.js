import * as React from "preact/compat";
import PropTypes from 'prop-types';
import clsx from 'clsx';
import withStyles from '@material-ui/styles/withStyles';
import { alpha } from '@material-ui/core/styles/colorManipulator';
import ButtonBase from '@material-ui/core/ButtonBase';
import capitalize from '@material-ui/core/utils/capitalize';
import { visibleRafLoop } from '../utils/visibility';

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
            // Reset on touch devices, it doesn't add specificity
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
        overflow: 'hidden',
        '& canvas': {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
        },
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
    /* Styles applied to the root element if `variant="text"`. */
    text: {
        padding: '6px 8px',
    },
    /* Styles applied to the root element if `variant="text"` and `color="primary"`. */
    textPrimary: {
        color: theme.palette.primary.main,
        '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.hoverOpacity),
            // Reset on touch devices, it doesn't add specificity
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
            // Reset on touch devices, it doesn't add specificity
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
            // Reset on touch devices, it doesn't add specificity
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
            // Reset on touch devices, it doesn't add specificity
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
            // Reset on touch devices, it doesn't add specificity
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
            // Reset on touch devices, it doesn't add specificity
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
            // Reset on touch devices, it doesn't add specificity
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


const vertexShaderSource = `#version 300 es
in vec2 position;
out vec2 fragCoord;
void main() {
  fragCoord = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentShaderSource = `#version 300 es
precision highp float;

uniform vec3 iResolution;
uniform float iTime;

out vec4 fragColor;

// Constants
const float _Speed = 5.5 * 0.002;
const float _Scale = 0.2;
const float _Gamma = 0.15;
const float _Colour = 0.15;
const float _Brightness = 2.0;
const float _Lacunarity = 1.6;

// Procedural noise (iq style)
float hash(float n) {
  return fract(sin(n) * 43758.5453);
}

float noise(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n = p.x + p.y * 57.0 + 113.0 * p.z;
  return mix(
    mix(
      mix(hash(n + 0.0), hash(n + 1.0), f.x),
      mix(hash(n + 57.0), hash(n + 58.0), f.x),
      f.y
    ),
    mix(
      mix(hash(n + 113.0), hash(n + 114.0), f.x),
      mix(hash(n + 170.0), hash(n + 171.0), f.x),
      f.y
    ),
    f.z
  );
}

// x3
vec3 noise3(vec3 x) {
  return vec3(
    noise(x + vec3(123.456, 0.567, 0.37)),
    noise(x + vec3(0.11, 47.43, 19.17)),
    noise(x)
  );
}

mat3 rotation(float angle, vec3 axis) {
  float s = sin(-angle);
  float c = cos(-angle);
  float oc = _Colour - c;
  vec3 sa = axis * s;
  vec3 oca = axis * oc;
  return mat3(
    oca.x * axis + vec3(c, -sa.z, sa.y),
    oca.y * axis + vec3(sa.z, c, -sa.x),
    oca.z * axis + vec3(-sa.y, sa.x, c)
  );
}

// Fractional Brownian Motion
vec3 fbm(vec3 x, float H, float L) {
  vec3 v = vec3(0.0);
  float f = 1.0;

  for (int i = 0; i < 7; i++) {
    float w = pow(f, -H);
    v += noise3(x) * w;
    x *= L;
    f *= L;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  uv.x *= iResolution.x / iResolution.y;

  float time = iTime * _Speed;

  uv *= 1.0 + 0.25 * sin(time * 10.0);  // drift scale in and out

  vec3 p = vec3(uv * _Scale, time);

  vec3 axis = 4.0 * fbm(p, 0.5, _Lacunarity);

  vec3 colorVec = 0.5 * 5.0 * fbm(p * 0.3, 0.5, _Lacunarity);

  colorVec = rotation(3.0 * length(axis), normalize(axis)) * colorVec;
  colorVec *= 0.05;

  colorVec = pow(colorVec, vec3(_Gamma));
  fragColor = vec4(_Brightness * colorVec * colorVec, 1.0);
}`;


// Initializes the shader pipeline on `canvas` and starts a render loop
// that auto-pauses while the tab is hidden or the button is off-screen.
// Returns a cleanup function that cancels the loop, disconnects the
// ResizeObserver, deletes every GL resource, and releases the context —
// the previous version leaked an infinite rAF chain AND a webgl2
// context on every unmount (browsers cap live contexts at ~8–16, then
// force-lose the oldest).
function startWebGL2(canvas) {
    if (!canvas) return null;
    const gl = canvas.getContext('webgl2');
    if (!gl) return null;

    // Size once now, then only when the element actually changes size.
    // The old loop reset canvas.width every frame, which clears and
    // reallocates the backbuffer 60×/s for zero visual benefit.
    const syncSize = () => {
        const w = canvas.clientWidth | 0;
        const h = canvas.clientHeight | 0;
        if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
            canvas.width = w;
            canvas.height = h;
        }
    };
    syncSize();

    const compileShader = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
        return null;
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const positionLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const resolutionLoc = gl.getUniformLocation(program, 'iResolution');
    const timeLoc = gl.getUniformLocation(program, 'iTime');

    // Repaint on real size changes even while the loop is paused.
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(syncSize);
        ro.observe(canvas);
    }

    // Auto-pauses on hidden tab / off-screen element, resumes seamlessly.
    const stopLoop = visibleRafLoop(canvas, (time) => {
        syncSize(); // cheap compare; covers browsers without ResizeObserver

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        gl.uniform3f(resolutionLoc, canvas.width, canvas.height, 1.0);
        gl.uniform1f(timeLoc, time * 0.001);

        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    });

    return function cleanup() {
        stopLoop();
        if (ro) ro.disconnect();
        try {
            gl.deleteVertexArray(vao);
            gl.deleteBuffer(positionBuffer);
            gl.deleteProgram(program);
            if (vs) gl.deleteShader(vs);
            if (fs) gl.deleteShader(fs);
            const lose = gl.getExtension('WEBGL_lose_context');
            if (lose) lose.loseContext();
        } catch (e) { /* context may already be lost */ }
    };
}

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

    // Per-instance canvas lifecycle. React/Preact invokes a ref callback
    // with the element on mount and with `null` on unmount — the old
    // shared `ref={useWebGL2}` ignored the null call, so the render loop
    // and its webgl2 context outlived the component forever.
    const glCleanupRef = React.useRef(null);
    const canvasRef = React.useCallback((el) => {
        if (glCleanupRef.current) {
            glCleanupRef.current();
            glCleanupRef.current = null;
        }
        if (el) glCleanupRef.current = startWebGL2(el);
    }, []);

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
            <canvas style={{filter: "saturate(1.15) brightness(1.1) contrast(1.05)"}} ref={canvasRef} />
            {/*
       * The inner <span> is required to vertically align the children.
       * Browsers don't support `display: flex` on a <button> element.
       * https://github.com/philipwalton/flexbugs/blob/master/README.md#flexbug-9
       * TODO v5: evaluate if still required for the supported browsers.
       */}
            <span className={classes.label}>
        {startIcon}
                {children}
                {endIcon}
      </span>
        </ButtonBase>
    );
});

Button.propTypes = {
    // ----------------------------- Warning --------------------------------
    // | These PropTypes are generated from the TypeScript type definitions |
    // |     To update them edit the d.ts file and run "yarn proptypes"     |
    // ----------------------------------------------------------------------
    /**
     * The content of the button.
     */
    children: PropTypes.node,
    /**
     * Override or extend the styles applied to the component.
     * See [CSS API](#css) below for more details.
     */
    classes: PropTypes.object,
    /**
     * @ignore
     */
    className: PropTypes.string,
    /**
     * The color of the component. It supports those theme colors that make sense for this component.
     */
    color: PropTypes.oneOf(['default', 'inherit', 'primary', 'secondary']),
    /**
     * The component used for the root node.
     * Either a string to use a HTML element or a component.
     */
    component: PropTypes /* @typescript-to-proptypes-ignore */.elementType,
    /**
     * If `true`, the button will be disabled.
     */
    disabled: PropTypes.bool,
    /**
     * If `true`, no elevation is used.
     */
    disableElevation: PropTypes.bool,
    /**
     * If `true`, the  keyboard focus ripple will be disabled.
     */
    disableFocusRipple: PropTypes.bool,
    /**
     * If `true`, the ripple effect will be disabled.
     *
     * ⚠️ Without a ripple there is no styling for :focus-visible by default. Be sure
     * to highlight the element by applying separate styles with the `focusVisibleClassName`.
     */
    disableRipple: PropTypes.bool,
    /**
     * Element placed after the children.
     */
    endIcon: PropTypes.node,
    /**
     * @ignore
     */
    focusVisibleClassName: PropTypes.string,
    /**
     * If `true`, the button will take up the full width of its container.
     */
    fullWidth: PropTypes.bool,
    /**
     * The URL to link to when the button is clicked.
     * If defined, an `a` element will be used as the root node.
     */
    href: PropTypes.string,
    /**
     * The size of the button.
     * `small` is equivalent to the dense button styling.
     */
    size: PropTypes.oneOf(['large', 'medium', 'small']),
    /**
     * Element placed before the children.
     */
    startIcon: PropTypes.node,
    /**
     * @ignore
     */
    type: PropTypes.oneOfType([PropTypes.oneOf(['button', 'reset', 'submit']), PropTypes.string]),
    /**
     * The variant to use.
     */
    variant: PropTypes.oneOf(['contained', 'outlined', 'text']),
};

export default withStyles(styles, { name: 'MuiButton' })(Button);