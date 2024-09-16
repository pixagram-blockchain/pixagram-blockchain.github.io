import init, { crt_upscale, hex_upscale, xbrz_upscale, get_memory } from '@pixagram/upscaler/wasm';
import { WorkerRenderer } from '@pixagram/upscaler';
const renderer = new WorkerRenderer();
// Initialize WASM module
await init();