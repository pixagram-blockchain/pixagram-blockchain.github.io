import * as React from "preact/compat";
import ButtonBase from "@material-ui/core/ButtonBase";
import { cssBackgroundImage } from "../utils/safeUrl";

const RADIUS_MOBILE = { borderRadius: "12px" };
const RADIUS_DESKTOP = { borderRadius: "0px 56px 56px 0px" };

// Shallow style equality — replaces JSON.stringify(prev) === JSON.stringify(next),
// which serialized both objects on every parent render just to compare them.
const sameStyle = (a, b) => {
    if (a === b) return true;
    if (!a || !b) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (let i = 0; i < ka.length; i++) {
        if (a[ka[i]] !== b[ka[i]]) return false;
    }
    return true;
};

const CommunityImage = React.memo(({
                                       image,
                                       name,
                                       className,
                                       style
                                   }) => {
    return (
        <ButtonBase style={className.includes("Mobile") ? RADIUS_MOBILE : RADIUS_DESKTOP}>
            <div
                className={className + " pixelated"}
                style={{
                    backgroundImage: cssBackgroundImage(image),
                    backgroundColor: "#333",
                    ...style
                }}
                alt={`Portal / ${name}`}
            />
        </ButtonBase>
    );
}, (prevProps, nextProps) => {
    return prevProps.image === nextProps.image &&
        prevProps.className === nextProps.className &&
        sameStyle(prevProps.style, nextProps.style);
});

export default CommunityImage;