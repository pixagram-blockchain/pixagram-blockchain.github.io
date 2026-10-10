import {Client} from "@gradio/client";

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
    guidance_scale: 1.0,
    num_inference_steps: 8,
    lora_intensity: 0.834,
    img2img_strength: 0.75,
    seed: -1,
    identity_preserve: true,
    lora_style: "retroart",
    identitynet_strength: 0.9,
    ip_adapter_scale: 0.9,
    resolution: 1280,
    aspect_ratio: "1:1",
    use_tiled: false,
    tile_size: 768,
    tile_overlap: 256,
};

export const transform = async (file, step_n, fidelity, callback = () => {}, callback2 = () => {}, description = "", style = "retroart") => {

    return new Promise(async function (resolve, reject) {
        callback("AI CONVERT");
        callback2("COMPUTE", Date.now(), Date.now() + 40 * 1000);

        var input_image = (file.size > 1000000) ? await resizeImageTo2MP(file) : file;
        var num_inference_steps = step_n;
        var img2img_strength = (0.825 - Math.min(0.4, Math.max(0, fidelity)));
        var guidance_scale = Math.max(1.0, 0.225+(step_n|0)/8);
        var lora_intensity = PRESETS_TRANSFORM.lora_intensity + (step_n/100);

        var dynamic_config = {
            ...PRESETS_TRANSFORM,
            lora_style: style,
            num_inference_steps,
            img2img_strength,
            input_image,
            guidance_scale,
            lora_intensity,
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


export const generate = async (text, ratio, num_inference_steps, callback = () => {}, callback2 = () => {}) => {

    return new Promise(async function (resolve, reject) {
        callback("AI CONVERT");
        callback2("COMPUTE", Date.now(), Date.now() + 8 * 1000);

        var dynamic_config = {
            ...PRESETS_TRANSFORM,
            num_inference_steps,
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