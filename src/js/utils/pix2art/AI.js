import {Client} from "@gradio/client";
import { AI_TYPE } from "../ai_provenance";

/**
 * Resizes a Blob image to approximately 1 Megapixel (1MP) and converts it to JPEG.
 * * @param {Blob} imageBlob - The input image Blob or File.
 * @returns {Promise<Blob>} - A Promise that resolves to the resized JPEG Blob.
 */

const _canvasFallback = typeof OffscreenCanvas === 'undefined' ? document.createElement('canvas') : null;
async function resizeImageTo2MP(imageBlob) {
    // 1. Load the Blob into an ImageBitmap
    const img = await createImageBitmap(imageBlob);

    // 2. Calculate new dimensions
    const width = img.width;
    const height = img.height;
    const currentPixels = width * height;
    const targetPixels = 2000000; // 2MP

    let newWidth = width;
    let newHeight = height;

    // Only resize if the image is larger than 1MP
    if (currentPixels > targetPixels) {
        const scaleFactor = Math.sqrt(targetPixels / currentPixels);
        newWidth = Math.floor(width * scaleFactor);
        newHeight = Math.floor(height * scaleFactor);
    }

    // 3. Draw to canvas (OffscreenCanvas preferred, DOM canvas fallback)
    if (typeof OffscreenCanvas !== 'undefined') {
        const offscreen = new OffscreenCanvas(newWidth, newHeight);
        const ctx = offscreen.getContext('2d');
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        return offscreen.convertToBlob({ type: 'image/jpeg', quality: 0.75 });
    }

    _canvasFallback.width = newWidth;
    _canvasFallback.height = newHeight;
    const ctx = _canvasFallback.getContext('2d');
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    return new Promise((resolve, reject) => {
        _canvasFallback.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Canvas to Blob conversion failed'));
                }
            },
            'image/jpeg',
            0.75
        );
    });
}
export const caption = async (file, callback = () => {}, callback2 = () => {}) => {
    return Promise.resolve("a person");
}

const PRESETS_TRANSFORM = {
    additional_prompt: "",
    // Replaced on every request by the sliders (SLIDER_VALUES below); the
    // values here are their defaults. generate() replaces only steps and
    // guidance: img2img_strength has no effect without a picture.
    guidance_scale: 1.25,
    num_inference_steps: 12,
    lora_intensity: 0.85,
    img2img_strength: 0.65,
    seed: -1,
    identity_preserve: true,
    lora_style: "retroart",
    identitynet_strength:1.0,
    ip_adapter_scale: 1.0,
    resolution: 1800,
    aspect_ratio: "1:1",
    use_tiled: false,
    tile_size: 832,
    tile_overlap: 192,
};

// Turbo mode — the checkbox under the style list. Renders at 768 px with a
// 768 px tile, so the whole picture is a single tile: about 4x faster than
// the default 1280 px pass. The AI output is reduced to pixel art of a few
// hundred pixels afterwards, so 768 px is still plenty of source. Both keys
// already exist on /process_image, so the Space needs no change.
const TURBO_TRANSFORM = {
    resolution: 768,
    tile_size: 768,
};

// Time the progress ring takes to fill; past it, the ring turns into the
// "finalising" spinner until the Space answers.
const TRANSFORM_ETA_MS = 40 * 1000;
const TURBO_TRANSFORM_ETA_MS = TRANSFORM_ETA_MS / 4;

// Per-style shifts applied on top of the values the transformation /
// fidelity sliders produce. "homm" is a painting style that needs a lighter
// touch than the pixel-art LoRAs.
const STYLE_OFFSETS = {
    homm: {
        num_inference_steps: -2,
        guidance_scale: -0.2,
        lora_intensity: -0.1,   // style strength
        img2img_strength: -0.1, // image strength
    },
};

// ── Sliders ───────────────────────────────────────────────────────────────
// NewPost's "Transformation strength" and "Conservation strength" sliders
// are signed percentages, −50 … +50, 0 being the default. Their positions
// reach transform() / generate() as shown (through processImageFile) and
// are turned into the Space's parameters here. ImageWizard, which shows no
// sliders, sends the default.
export const AI_SLIDER_MIN = -50;
export const AI_SLIDER_MAX = 50;
export const AI_SLIDER_DEFAULT = 0; // the scale is signed around it

// What the sliders set: [value at −50 %, at 0, at +50 %], linear in between.
// Read against the Space (face-to-pixel-art-4K):
//  - img2img_strength becomes diffusers' denoising `strength` there
//    (generator.py): the share of the picture that is redrawn, halved on
//    pictures without a face (config.py). More conservation is therefore
//    LESS strength: +50 % → 0.45. Swap the two ends to reverse it.
//  - guidance_scale under FACE_GUIDANCE_MIN (1.5) is raised to it on face
//    pictures, so the guidance part only acts on pictures without a face.
// Style offsets (STYLE_OFFSETS) apply on top of these values.
const SLIDER_VALUES = {
    // Transformation strength
    num_inference_steps: [8, 12, 16],
    guidance_scale: [1.0, 1.25, 1.5],
    // Conservation strength
    img2img_strength: [0.85, 0.65, 0.45],
};

// A slider position → the value SLIDER_VALUES[key] gives it. A missing or
// unreadable position reads as the default, an out-of-range one as the
// nearest end.
const fromSlider = (key, position) => {
    const [atMin, atDefault, atMax] = SLIDER_VALUES[key];
    const p = Math.min(AI_SLIDER_MAX, Math.max(AI_SLIDER_MIN, Number(position) || AI_SLIDER_DEFAULT));
    return p < 0
        ? atDefault + (atMin - atDefault) * (p / AI_SLIDER_MIN)
        : atDefault + (atMax - atDefault) * (p / AI_SLIDER_MAX);
};

// Decimals go out as numbers rounded to 2 places, not toFixed() strings:
// generator.py does arithmetic on img2img_strength with no float() cast.
const round2 = (value) => Math.round(value * 100) / 100;

// ── Provenance ────────────────────────────────────────────────────────────
// What made a picture here, as processImageFile reports it: { type, model }.
// `model` pre-fills the Post step's "AI used" field, published as
// json_metadata.ai (utils/ai_provenance.js). Keep it in step with the Space:
// its base checkpoint, the LoRA each style loads, and the identity adapter
// `identity_preserve` turns on (FaceID).
const BASE_MODEL = "SDXL";
const LORA_NAMES = {
    retroart: "RetroArt",
    lucasart: "LucasArt",
    vga: "VGA",
    homm: "HoMM",
};
const loraLabel = (style) => `${LORA_NAMES[style] || style} LoRA`;

// transform(): the picture is redrawn with the style's LoRA while FaceID
// keeps the subject's identity.
export const describeTransform = (style = PRESETS_TRANSFORM.lora_style) => ({
    type: AI_TYPE.TRANSFORMATION,
    model: [BASE_MODEL, loraLabel(style), ...(PRESETS_TRANSFORM.identity_preserve ? ["FaceID"] : [])].join(" + "),
});

// generate(): text to image with the presets' LoRA. There is no picture, so
// no face for FaceID to keep.
export const describeGenerate = () => ({
    type: AI_TYPE.GENERATION,
    model: [BASE_MODEL, loraLabel(PRESETS_TRANSFORM.lora_style)].join(" + "),
});

// style: LoRA preset — "retroart" | "lucasart" | "vga" | "homm".
// transformation / conservation: the two sliders' positions, −50 … +50
// (0 = default; see SLIDER_VALUES).
// turbo: one 768 px tile instead of the 1280 px pass (TURBO_TRANSFORM).
export const transform = async (file, transformation, conservation, callback = () => {}, callback2 = () => {}, description = "", style = "retroart", turbo = false) => {

    return new Promise(async function (resolve, reject) {
        callback("AI CONVERT");
        callback2("COMPUTE", Date.now(), Date.now() + (turbo ? TURBO_TRANSFORM_ETA_MS : TRANSFORM_ETA_MS));

        // Values come from the sliders first and are shifted afterwards, so a
        // style's offsets hold at every slider position. LoRA intensity is on
        // no slider: the preset, shifted.
        const offsets = STYLE_OFFSETS[style] || {};
        const shift = (key, value) => value + (offsets[key] || 0);

        var input_image = (file.size > 1000000) ? await resizeImageTo2MP(file) : file;
        var num_inference_steps = Math.max(1, shift("num_inference_steps", Math.round(fromSlider("num_inference_steps", transformation))));
        var img2img_strength = round2(shift("img2img_strength", fromSlider("img2img_strength", conservation)));
        var guidance_scale = round2(shift("guidance_scale", fromSlider("guidance_scale", transformation)));
        var lora_intensity = round2(shift("lora_intensity", PRESETS_TRANSFORM.lora_intensity));

        var dynamic_config = {
            ...PRESETS_TRANSFORM,
            ...(turbo ? TURBO_TRANSFORM : null),
            lora_style: style,
            lora_intensity,
            num_inference_steps,
            img2img_strength,
            input_image,
            guidance_scale,
            additional_prompt: PRESETS_TRANSFORM.additional_prompt + " " + description,
        };
        try {

            const client = await Client.connect("primerz/face-to-pixel-art-4K");
            const result = await client.predict("/process_image", dynamic_config);

            const data = result.data || [];
            const image = data[0] || {};
            const url = image["url"] || image;
            const blob = await (await fetch(url)).blob();
            const prompt = data[1] || " Output: ";
            const title = prompt.split("Output: ")[1];
            resolve(blob, title);

        } catch (e) {
            console.log(e)
            reject("Please Try Again Later")
        }
    });
}


// transformation: the "Transformation strength" slider's position, −50 …
// +50 (0 = default); it sets steps and guidance as in transform().
export const generate = async (text, ratio, transformation, callback = () => {}, callback2 = () => {}) => {

    return new Promise(async function (resolve, reject) {
        callback("AI CONVERT");
        callback2("COMPUTE", Date.now(), Date.now() + 8 * 1000);

        var dynamic_config = {
            ...PRESETS_TRANSFORM,
            num_inference_steps: Math.round(fromSlider("num_inference_steps", transformation)),
            guidance_scale: round2(fromSlider("guidance_scale", transformation)),
            additional_prompt: text,
        };
        try {

            const client = await Client.connect("primerz/face-to-pixel-art-4K");
            const result = await client.predict("/process_image", dynamic_config);

            const data = result.data || [];
            const image = data[0] || {};
            const url = image["url"] || image;
            const blob = await (await fetch(url)).blob();
            const prompt = data[1] || " Output: ";
            const title = prompt.split("Output: ")[1];
            resolve(blob, title);

        } catch (e) {
            console.log(e)
            reject("Please Try Again Later")
        }
    });
}