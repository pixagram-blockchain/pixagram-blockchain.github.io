export const overrides = {
    MuiCssBaseline: {
        "@global": {
            "*::selection": {
                background: "#ddd",
                color: "#171717"
            },
            "a": {
                color: "#eee"
            },
            "a:visited": {
                color: "#ddd"
            },
            "a:hover": {
                color: "#fff"
            },
            html: {
                textRendering: "optimizespeed",
                fontFamily: `"Red Hat Display", "Geist Mono"`,
                overflow: "hidden",
                height: "100%",
                maxHeight: "100%",
                backgroundColor: "#000",
            },
            "body.loaded": {
                fontFamily: `"Red Hat Display", "Geist Mono"`,
                fontSize: "auto !important",
                overflow: "hidden",
                backgroundColor: "#000",
                height: "100%",
                // dvh = the VISIBLE viewport on mobile (100vh is the
                // URL-bar-hidden height on Android Chrome / iOS Safari).
                // JSS emits `fallbacks` first, so old engines keep the
                // vh clamp and modern ones take the dvh one.
                fallbacks: { maxHeight: "min(100vh, 100%)" },
                maxHeight: "min(100dvh, 100%)",
            },
            "div.MuiChip-root": {
                backgroundColor: "#212121"
            },
            ".MuiChip-root, .MuiAccordion-rounded .MuiTypography-body1": {
                fontFamily: `"Industry Book", "Normative Pro" !important`,
            },
            ".monospace, .MuiBadge-badge": {
                fontFamily: `"Geist Mono", "Red Hat Display" !important`,
            },
            ".MuiFormLabel-root, svg, button, svg.recharts-surface, .MuiTab-wrapper, .MuiListSubheader-root, .MuiList-root > .MuiListSubheader-root": {
                fontFamily: `"Industry Book", "Normative Pro" !important`,
            },
            "div.recharts-wrapper": {
                overflow: "visible !important",
            },
            "div.recharts-wrapper > svg": {
                overflow: "initial !important",
            },
            ".MuiList-padding": {
                paddingTop: 4,
                paddingBottom: 4
            },
            "body > #app": {
                height: "100%",
            },
            "blockquote": {
                color: "#666"
            },
            "div.MuiTooltip-popper > div.MuiTooltip-tooltip": {
                fontFamily: `"Red Hat Display", "Normative Pro" !important`,
                backgroundColor: "#eee",
                color: "#171717"
            },
            ".MuiButtonBase-root.MuiChip-root": {
                borderRadius: "18px !important",
                backgroundColor: "#272727",
                "& .MuiSvgIcon-root": {
                    fill: "#474747"
                },
                "&:hover": {
                    backgroundColor: "#353535",
                    "& .MuiSvgIcon-root": {
                        fill: "#555555"
                    },
                }
            },
            "div.MuiAccordion-rounded.MuiPaper-rounded": {
                borderRadius: "0px"
            },
            ".MuiListItem-button": {
                borderRadius: "21px !important"
            },
            ".MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: "#ffffff80 !important",
                transition: "border-color 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            },
            ".MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline": {
                transition: "border-color 200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            },
            ".MuiOutlinedInput-root, .MuiFilledInput-root": {
                borderRadius: "16px !important"
            },
            ".MuiFilledInput-root.Mui-focused.MuiAutocomplete-inputRoot": {
                borderBottomLeftRadius: "0px !important",
                borderBottomRightRadius: "0px !important"
            },
            "div.MuiFilledInput-root": {
                backgroundColor: "rgba(255, 255, 255, 0.045)"
            },
            "div.MuiAutocomplete-inputRoot.Mui-focused": {
                borderRadius: "24px"
            },
            "div.MuiFilledInput-adornedEnd": {
                borderRadius: "24px"
            },
            "div.MuiAutocomplete-popper .MuiPaper-root": {
                marginTop: -4,
                borderRadius: "24px",
                borderTopLeftRadius: "0px !important",
                borderTopRightRadius: "0px !important"
            },
            ".MuiPickersDay-current": {
                color: "#000 !important",
                backgroundColor: "#fff !important"
            },
            ".MuiPickersYear-yearSelected": {
                color: "#fff !important"
            },
            ".MuiPickersCalendarHeader-iconButton": {
                backgroundColor: "#171717 !important"
            },
            ".MuiPickersToolbar-toolbar": {
                backgroundColor: "#171717 !important"
            },
            "div.MuiDrawer-paperAnchorLeft": {
                borderRadius: "0px 21px 21px 0px"
            },
            "div.MuiFilledInput-underline:before, div.MuiFilledInput-underline:after": {
                width: "calc(100% - 32px)",
                left: "16px"
            },
            ".MuiButtonGroup-groupedTextHorizontal:not(:last-child)": {
                borderRight: "1px solid rgb(255 255 255 / 10%)"
            },
            "h1 > p, h2 > p, h3 > p, h4 > p, h5 > p, h6 > p": {
                margin: 0,
            },
            ".shiny": {
                overflow: "hidden",
            },
            ".shiny::after": {
                position: "absolute",
                width: "100%",
                height: "100%",
                content: `""`,
                backgroundColor: "#00000000",
                background: "linear-gradient(-135deg, transparent 20%, rgba(255,255,255, .1) 20%, rgba(255,255,255, .1) 50%, transparent 50%), linear-gradient(-135deg, transparent 25%, rgba(255,255,255, .1) 25%, rgba(255,255,255, .1) 45%, transparent 45%), linear-gradient(-135deg, transparent 30%, rgba(255,255,255, .15) 30%, rgba(255,255,255, .15) 40%, transparent 40%)",
                backgroundSize: "200%",
                backgroundPosition: "200% 50%",
                transition: "c",
            },
            "span.MuiSlider-root": {
                color: "#eee"
            },
            "span.MuiSlider-valueLabel > span > span": {
                color: "#222"
            },
            ".MuiCollapse-entering, .MuiCollapse-exiting": {
                willChange: "height"
            },
            ".shiny::after:hover": {
                backgroundPosition: "0% 50%",
                transition: "background-position cubic-bezier(0.4, 0, 0.2, 1) 175ms",
            },
            ".speed:, .speed: *, .speed:not(a), .speed:not(a) *": {
                imageRendering: "optimizeSpeed",
            },
            ".pixelated, .pixelated *, .pixelated:not(a), .pixelated:not(a) *": {
                imageRendering: "-moz-crisp-edges",
            },
            ".pixelated, .pixelated *, .pixelated:not(b), .pixelated:not(b) *": {
                imageRendering: "-webkit-crisp-edges",
            },
            ".pixelated, .pixelated *, .pixelated:not(c), .pixelated:not(c) *": {
                imageRendering: "-o-pixelated",
            },
            ".pixelated, .pixelated *, .pixelated:not(d), .pixelated:not(d) *": {
                imageRendering: "-o-crisp-edges",
            },
            ".pixelated, .pixelated *, .pixelated:not(e), .pixelated:not(e) *": {
                imageRendering: "crisp-edges",
            },
            ".pixelated, .pixelated *, .pixelated:not(f), .pixelated:not(f) *": {
                "-ms-interpolation-mode": "nearest-neighbor",
            },
            ".pixelated, .pixelated *, .pixelated:not(g), .pixelated:not(g) *": {
                imageRendering: "pixelated",
            },
            "video": {
                animationName: "$fadin",
                animationDuration: "550ms",
                animationFillMode: "both",
                animationDelay: "50ms",
                "@global": {
                    "@keyframes fadin": {
                        "0%": {filter: "opacity(0)", animationTimingFunction: "linear"},
                        "20%": {filter: "opacity(0)", animationTimingFunction: "cubic-bezier(0.280, 0.840, 0.420, 1)"},
                        "100%": {filter: "opacity(1)", animationTimingFunction: "cubic-bezier(0.280, 0.840, 0.420, 1)"},
                    }
                },
            },
            "div.arrival":{
                background: "linear-gradient(180deg, #00000078 -25%, #00000061 0%, #00000045 35%, #0000001a 90%, transparent)",
            },
            "div.arrival::after":{
                content: "''",
                contain: "style size layout",
                position: "fixed",
                width: "100%",
                zIndex: 9999999,
                top: 5,
                height: "95%",
                background: "radial-gradient(#00000000 27%, #002bffb5 35%, #00000000 40%, #1000ffab 42.5%, #00000000 45%)",
                left: 0,
                backgroundSize: "600% 400%",
                animationIterationCount: "infinite",
                animationDelay: "250ms !important",
                animationFillMode: "both !important",
                animationTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1) !important",
                animationName: "$arrival !important",
                animationDuration: "1500ms !important",
                backgroundPosition: "50% 50%",
                mixBlendMode: "color",
                "@global": {
                    "@keyframes arrival": {
                        "0%": {display: "block", transform: "translateY(150%)", opacity: .7},
                        "25%": {display: "block", transform: "translateY(50%)", opacity: 0.9},
                        "50%": {display: "block", transform: "translateY(0%)", opacity: 0},
                        "75%": {display: "block", transform: "translateY(-50%)", opacity: 0},
                        "100%": {display: "none", transform: "translateY(-100%)", opacity: 0},
                    }
                }
            },
            ".fade-in-500-500": {
                verticalAlign: "inherit",
                animationName: "$fadin500500",
                animationDuration: "500ms",
                animationTimingFunction: "cubic-bezier(0.280, 0.840, 0.420, 1)",
                animationFillMode: "both",
                animationDelay: "500ms",
                "@global": {
                    "@keyframes fadin500500": {
                        "0%": {filter: "opacity(0)"},
                        "100%": {filter: "opacity(1)"},
                    }
                }
            },
            ".emoji": {
                verticalAlign: "inherit",
                height: "1em",
                width: "1em",
            },
            ".bouncehover:hover": {
                animation: "$bounce 1.2s cubic-bezier(0.280, 0.840, 0.420, 1) infinite 1s",
                "@global": {
                    "@keyframes bounce": {
                        "0%": {transform: "scale(1,1) translateY(0)"},
                        "10%": {transform: "scale(1.1,.9) translateY(0)"},
                        "30%": {transform: "scale(.9,1.1) translateY(-40px)"},
                        "50%": {transform: "scale(1.05,.95) translateY(0)"},
                        "57%": {transform: "scale(1,1) translateY(-3px)"},
                        "64%": {transform: "scale(1,1) translateY(0)"},
                        "100%": {transform: "scale(1,1) translateY(0)"},
                    }
                }
            },
            ".pulse": {
                animation: "$pulse 1.8s cubic-bezier(0.280, 0.840, 0.420, 1) infinite 0s",
                "@global": {
                    "@keyframes pulse": {
                        "0%": {transform: "scale(.9)"},
                        "10%": {transform: "scale(1)"},
                        "30%": {transform: "scale(.925)"},
                        "50%": {transform: "scale(1)"},
                        "57%": {transform: "scale(.9)"},
                        "64%": {transform: "scale(1)"},
                        "100%": {transform: "scale(.95)"},
                    }
                }
            },
            ".emoji-100": {
                verticalAlign: "inherit",
                height: "1em",
                width: "1.5em",
                transform: "scale(1.5)",
            },
            ".emoji-150": {
                verticalAlign: "inherit",
                height: "1.5em",
                width: "3em",
                transform: "scale(1.5)",
            },
            ".highlighted": {
                backgroundColor: "#e8ecfe",
            },
            "p img": {
                width: "100%",
                borderRadius: "32px"
            },
            'p img[alt~="emoji"]': {
                width: "1em",
                verticalAlign: "middle",
            },
            "*::-webkit-scrollbar": {
                width: "4px",
                padding: "2px"
            },
            "*::-webkit-scrollbar-track": {
                backgroundColor: "transparent"
            },
            "*::-webkit-scrollbar-thumb": {
                backgroundColor: "rgba(124,124,124,.3)",
                zIndex: "1",
                borderRadius: "2px"
            },
            ".MuiTouchRipple-rippleVisible": {
                contain: "layout size style",
                animation: "MuiTouchRipple-keyframes-enter 300ms cubic-bezier(0.4, 0, 0.2, 1)"
            },
            ".MuiAvatar-root": {
                contain: "style layout",
            },
            ".MuiTableSortLabel-root.MuiTableSortLabel-root.MuiTableSortLabel-active": {
                color: "inherit"
            },
            "div.MuiAccordion-root div.MuiAccordionDetails-root": {
                display: "block"
            },
            "div.MuiAccordionSummary-root > div.MuiAccordionSummary-content > *": {
                fontFamily: '"Industry Book", "Normative Pro"',
                fontWeight: "bold",
                width: "100%"
            },
            "div.MuiAccordion-root:before": {
                display: 'none !important',
            },
            "div.MuiAccordion-root.Mui-expanded + div.MuiAccordion-root:before": {
                display: 'none !important',
            },
            "div.MuiAccordion-root.Mui-expanded:before": {
                display: 'none !important',
            },
            "button.MuiButtonGroup-groupedHorizontal:not(:last-child)":{borderTopRightRadius: "0px !important", borderBottomRightRadius: "0px !important"},
            "button.MuiButtonGroup-groupedHorizontal:not(:first-child)":{borderTopLeftRadius: "0px !important", borderBottomLeftRadius: "0px !important"},
            "div.MuiAccordion-rounded:first-child": { borderTopLeftRadius: "21px", borderTopRightRadius: "21px" },
            "div.MuiAccordion-rounded:last-child": { borderBottomLeftRadius: "21px", borderBottomRightRadius: "21px" },
            "div.MuiPaper-rounded": {
                borderRadius: "21px"
            },
            ".MuiStepIcon-text": {
                fill: "#000 !important",
                color: "#000 !important",
            },
            ".MuiStepIcon-root.MuiStepIcon-active, .MuiStepIcon-root.MuiStepIcon-completed": {
                color: "#fff !important",
                fill: "#fff !important"
            },
            "div.MuiDialogActions-root": {
                backgroundColor: "transparent",
                padding: "24px",
                "& .MuiButton-root": {
                    color: "#666",
                    borderRadius: "12px"
                },
                "& .MuiButton-containedPrimary": {
                    color: "#aaa",
                    backgroundColor: "#222",
                    boxShadow: "0px 3px 1px -2px rgba(34, 34, 34,0.2),0px 2px 2px 0px rgba(34, 34, 34,0.14),0px 1px 5px 0px rgba(34, 34, 34,0.12)"
                },
                "& .MuiButton-containedPrimary.Mui-disabled": {
                    color: "#666",
                    backgroundColor: "#222",
                    boxShadow: "none"
                },
                "& .MuiButton-containedPrimary:hover": {
                    color: "#ddd",
                    backgroundColor: "#333"
                }
            },
            "div.MuiAutocomplete-inputRoot.Mui-focused:before, div.MuiAutocomplete-inputRoot.Mui-focused:after": {
                left: 0,
                width: "calc(100%)",
                opacity: .1
            },
            "div.MuiInputBase-root": {
                color: "#ddd",
            },
            "div.MuiFilledInput-root:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.06)"
            },
            "div.MuiFilledInput-underline:before": {
                borderBottom: "1px solid #ffffff40"
            },
            "div.MuiFilledInput-underline:hover:before": {
                borderBottom: "1px solid #ffffffa8"
            },
            "div.MuiAlert-standardInfo": {
                color: "#eee",
                backgroundColor: "#101010",
                borderRadius: "21px"
            },
            "div.MuiAlert-standardInfo div.MuiAlert-icon": {
                color: "#fff"
            },
            "div.MuiAlert-message": {
                color: "#bbb"
            },
            "div.MuiFilledInput-underline:after, div.MuiFilledInput-underline:after": {
                borderBottom: "2px solid #eee"
            },
            ".MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "#666"
            },
            ".scroll-will-change": {
                willChange: "scroll"
            },
            "span > span.MuiSwitch-colorPrimary + .MuiSwitch-track": {
                opacity: 0.15
            },
            "span > span.MuiSwitch-colorPrimary.Mui-checked + .MuiSwitch-track": {
                opacity: 0.45,
                backgroundColor: "#fff"
            },
            "span > span.MuiSwitch-colorPrimary.Mui-checked": {
                color: "#efefef"
            },
            "span > span.MuiSwitch-colorPrimary": {
                color: "#c6c6c6"
            },
            ".MuiRadio-colorPrimary.Mui-checked, .MuiCheckbox-colorPrimary.Mui-checked, .MuiRadio-colorSecondary.Mui-checked": {
                color: "#ffffff !important"
            },
            ".MuiFormLabel-root.Mui-focused": {
                color: "#fff !important",
            },
            "div.MuiPaper-root": {
                backgroundColor: "#000000",
                color: "#eee",
            },
            ".MuiOutlinedInput-input:-webkit-autofill": {
                WebkitBoxShadow: "0 0 0 100px #000000 inset !important",
                WebkitTextFillColor: "#fff !important"
            },
            "input:-internal-autofill-selected": {
                color: "#fff !important",
                background: "transparent !important"
            },
            ".MuiCheckbox-colorSecondary.Mui-checked": {
                color: "#fff !important"
            },
            "div.MuiDialog-paper.medium": {
                margin: "0 !important",
                minWidth: "min(100%, 736px)",
                backgroundColor: "#101010"
            },
            "div.MuiMenu-paper": {
                backgroundColor: "#101010"
            },
            ".MuiFab-root.MuiFab-extended": {
                borderRadius: 4,
                background: "#c7c7c7",
                color: "#1a1a1a",
                transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
            },
            ".MuiFab-root.MuiFab-extended:hover": {
                background: "#ffffff",
                color: "#000",
                transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms"
            },
            ".MuiButtonBase-root.MuiFab-root": {
                borderRadius: 24,
                background: "#c7c7c7",
                color: "#1a1a1a",
                transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
            },
            ".MuiButtonBase-root.MuiFab-root:hover": {
                background: "#ffffff",
                color: "#000",
                transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms"
            },
            ".MuiSvgIcon-root.MuiChip-deleteIcon": {
                color: "#8484844d",
                transition: "color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms"
            },
            ".MuiSvgIcon-root.MuiChip-deleteIcon:hover": {
                color: "#848484ba",
                transition: "color 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
            },
            ".MuiTooltip-popper .MuiTooltip-tooltip": {
                backgroundColor: "#000000",
                fontsize: "16px",
            },".MuiTooltip-popper .MuiTooltip-arrow": {
                color: "#000000",
            },
            ".MuiTooltip-popper.green .MuiTooltip-tooltip": {
                backgroundColor: '#98ff7c88',
                color: '#98ff7c',
            },
            ".MuiDialog-paper h1": {
                color: '#fff',
                margin: "0px 0px 16px 0px"
            },
            "svg": {
                fontFamily: "Open Sans !important"
            },
            "div.MuiPaper-rounded.MuiDialog-paper": {
                borderRadius: "38px"
            },
            "button.MuiButton-root": {
                borderRadius: "12px"
            },
            "button.MuiButton-textPrimary": {
                color: "#ffffff"
            },
            "span.MuiBadge-colorPrimary": {
                color: "#aaa",
                backgroundColor: "#333"
            },
            ".MuiDrawer-paper": {
                backgroundColor: "#171717 !important",
                maxWidth: "284px !important"
            },
            ".MuiBadge-colorSecondary": {
                backgroundColor: "#ffffff"
            },
            "div.MuiLinearProgress-barColorPrimary": {
                backgroundColor: "#fff"
            },
            "div.MuiLinearProgress-colorPrimary": {
                backgroundColor: "#4b4b4b"
            },
            ".MuiCheckbox-colorSecondary.Mui-checked, a": {
                color: "#ffffff"
            },
            ".MuiCircularProgress-colorPrimary": {
                color: "#ffffff"
            },
            "div.MuiPaper-root.MuiStepper-horizontal": {
                backgroundColor: "transparent !important"
            },
            ".MuiTab-textColorPrimary .MuiTab-wrapper": {
                color: "#ffffff80",
                transition: "color 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
            },
            ".Mui-selected.MuiTab-textColorPrimary .MuiTab-wrapper": {
                color: "#ffffffCC",
                transition: "color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms"
            },
            ".MuiBackdrop-root": {
                backgroundColor: "#1010105c",
                filter: "opacity(1)",
                animation: "$fadeBlur 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
                "@global": {
                    "@keyframes fadeBlur": {
                        "0%": {
                            transform: "opacity(0)",
                        },
                        "100%": {
                            transform: "opacity(1)",
                        },
                    }
                }
            },
            ".MuiFormGroup-row": {
                flexWrap: "wrap",
                alignContent: "stretch",
                justifyContent: "space-between",
            }
        },
    },
}