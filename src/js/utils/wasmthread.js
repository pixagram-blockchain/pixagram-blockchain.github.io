export default class UniversalWasmWorker {
    constructor() {
        this._id = 0;
        this._callbacks = new Map();
        this._init = 0;

        const workerCode = `(function workerLogic() {
            let instance;
        
            self.onmessage = async (e) => {
                const { type, data, id } = e.data;
        
                try {
                    if (type === "init") {
                        const binary = Uint8Array.from(atob(data.wasmBase64), c => c.charCodeAt(0)).buffer;
                        const module = await WebAssembly.instantiate(binary);
                        instance = module.instance;
                        postMessage({ id, result: "WASM loaded" });
                    }
        
                    if (type === "call") {
                        if (!instance) throw "WASM not initialized.";
                        const { funcName, args } = data;
                        const fn = instance.exports[funcName];
                        if (typeof fn !== "function") throw \`Export "${funcName}" not found\`;
                        const result = fn(...args);
                        postMessage({ id, result });
                    }
                } catch (err) {
                    postMessage({ id, error: err.toString() });
                }
            };
        })()`;
        const workerBase64 = btoa(workerCode);
        const blob = new Blob([atob(workerBase64)], { type: "application/javascript" });
        const blobUrl = URL.createObjectURL(blob);

        this.worker = new Worker(blobUrl);
        this.worker.onmessage = (e) => {
            const { id, result, error } = e.data;
            const callback = this._callbacks.get(id);
            if (callback) {
                error ? callback.reject(error) : callback.resolve(result);
                this._callbacks.delete(id);
            }
        };
        URL.revokeObjectURL(blobUrl);
    }

    _send(type, data, transfer = []) {
        const id = ++this._id;
        return new Promise((resolve, reject) => {
            this._callbacks.set(id, { resolve, reject });
            this.worker.postMessage({ id, type, data }, transfer);
        });
    }

    static arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    async loadWasmFromUrl(url) {
        if(this._init > 0){ return this; }
        const buffer = await fetch(url).then(r => r.arrayBuffer());
        const base64 = UniversalWasmWorker.arrayBufferToBase64(buffer);
        const that = this;
        this._send("init", { wasmBase64: base64 }).then(() => {
            that._init = 1;
            return that;
        });
    }

    async call(funcName, args = []) {
        return this._send("call", { funcName, args });
    }

    terminate() {
        this._init = 0;
        this.worker.terminate();
        this._callbacks.clear();
    }
}
