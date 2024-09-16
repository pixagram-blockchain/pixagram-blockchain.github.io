import {png_quant as encPNG} from "./png_quant";
import {default as encWEBP} from '@jsquash/webp/encode';
const encJPEG = {};

encWEBP.encodeImageData = async function (rawImageData, lossless = false) {
    const params = lossless ? {
        quality: 0,               // Quality is irrelevant in lossless mode.
        target_size: 0,           // Not used in lossless mode.
        target_PSNR: 0,           // Not used in lossless mode.
        method: 6,                // Compression effort (4 is good for balance).
        sns_strength: 100,        // Set to 0 to avoid blending details, preserving pixel sharpness.
        filter_strength: 0,       // Filters can blur sharp edges in pixel art; keep at 0.
        filter_sharpness: 0,      // No additional sharpness adjustments.
        filter_type: 0,           // No filtering for pixel art.
        partitions: 0,            // Default partitions.
        segments: 4,              // Default segmentation; adjust if needed for more granular compression.
        pass: 6,                  // Single pass is usually sufficient for lossless.
        show_compressed: 0,       // Debug option; 0 for production.
        preprocessing: 0,         // No preprocessing; pixel art needs precise preservation.
        autofilter: 1,            // Disable autofilter for better control.
        partition_limit: 0,       // Not used in lossless.
        alpha_compression: 1,     // Enable compression for alpha channel.
        alpha_filtering: 0,       // Avoid filtering alpha channel.
        alpha_quality: 100,       // Maximum quality for alpha.
        lossless: 1,              // Enable lossless mode.
        exact: 1,                 // Preserve exact pixel colors.
        image_hint: 1,            // Default hint; consider 1 (GRAPH) if applicable.
        emulate_jpeg_size: 0,     // Irrelevant in lossless.
        thread_level: 0,          // Multithreaded for speed.
        low_memory: 0,            // Disable low-memory mode for full compression efficiency.
        near_lossless: 100,       // Use 0 for fully lossless mode.
        use_delta_palette: 1,     // Delta palette can improve compression in some cases.
        use_sharp_yuv: 0          // Irrelevant in lossless.
    }: {
        lossless: 0,              // Disable lossless mode.
        quality: 80,              // Quality is relevant in lossy mode
    };

    function blobToBase64(blob) {
        return new Promise((resolve, _) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }

    const buffer = await encWEBP(rawImageData, params);
    const imageBlob = new Blob([buffer], { type: `image/webp` });
    return await blobToBase64(imageBlob);
};
const canvas = document.createElement("canvas");
canvas.context = canvas.getContext("2d");

encPNG.encodeImageData = async function(rawImageData, lossless = false) {

    return await new Promise((resolve, reject) => {

        canvas.width = rawImageData.width;
        canvas.height = rawImageData.height;
        canvas.context.putImageData(rawImageData, 0, 0);

        encPNG(canvas.toDataURL("image/png"), lossless ? 100: 40, lossless ? 100: 80, lossless ? 1: 9, (base64url) => {
            resolve(base64url);
        })
    });
}

encJPEG.encodeImageData = async function(rawImageData, lossless = false) {
    return await new Promise((resolve, reject) => {
        canvas.width = rawImageData.width;
        canvas.height = rawImageData.height;
        canvas.context.putImageData(rawImageData, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", {quality: lossless ? 100: 80}));
    });
}
export async function encodeIMG(data, type, lossless){

    type = (type.toUpperCase() === "PNG") ?
        "PNG" :
        (type.toUpperCase() === "WEBP") ?
            "WEBP": "JPEG";

    async function loadImage(src) {
        if(src instanceof ImageData){
            return src;
        }
        const img = document.createElement('img');
        img.src = src;
        await new Promise(resolve => img.onload = resolve);
        const canvas = document.createElement('canvas');
        [canvas.width, canvas.height] = [img.width, img.height];
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, img.width, img.height);
    }



    const method = (type === "PNG") ?
        encPNG.encodeImageData.bind(this):
        (type === "WEBP") ?
            encWEBP.encodeImageData.bind(this):
            encJPEG.encodeImageData.bind(this);

    const rawImageData = await loadImage(data);
    return await method(rawImageData, lossless);
}

