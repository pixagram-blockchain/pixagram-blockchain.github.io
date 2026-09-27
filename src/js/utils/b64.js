import {TurboBase64} from "@pixagram/turbobase64";
var b64 = new TurboBase64();
export const bytesToBase64 = b64.encode.bind(b64);
export const base64ToBytes = b64.decode.bind(b64);