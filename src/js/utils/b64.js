import {B64chromium} from "chromium-base64";
var b64 = new B64chromium();
export const bytesToBase64 = b64.bytesToBase64.bind(b64);
export const base64ToBytes = b64.base64ToBytes.bind(b64);