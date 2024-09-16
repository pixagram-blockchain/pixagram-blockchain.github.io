////////////////////////////////////////////////////
// ColorUtils.js
////////////////////////////////////////////////////
/**
 * rgb2lab:
 *   - Uses D65 white point and the typical sRGB -> XYZ -> Lab conversion.
 *   - Returns [L*, a*, b*] with L in [0..100], a in ~[-128..128], b in ~[-128..128].
 */
function rgb2lab(R, G, B) {
    // Step A: sRGB -> linear
    let r = R / 255, g = G / 255, b = B / 255;
    r = (r > 0.04045) ? Math.pow((r + 0.055)/1.055, 2.4) : (r / 12.92);
    g = (g > 0.04045) ? Math.pow((g + 0.055)/1.055, 2.4) : (g / 12.92);
    b = (b > 0.04045) ? Math.pow((b + 0.055)/1.055, 2.4) : (b / 12.92);

    // Step B: linear RGB -> XYZ (D65)
    // Reference white point:
    //   Xn = 0.95047,  Yn = 1.0,  Zn = 1.08883
    let X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    let Y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
    let Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

    // Step C: XYZ -> Lab
    X = fLab(X);
    Y = fLab(Y);
    Z = fLab(Z);

    let L = 116 * Y - 16;
    let a = 500 * (X - Y);
    let b_ = 200 * (Y - Z);

    return [L, a, b_];
}

/**
 * Helper for Lab conversion
 */
function fLab(t) {
    // 0.008856 = (6/29)^3
    return (t > 0.008856)
        ? Math.cbrt(t)
        : (7.787 * t + 16/116);
}
class ColorUtils {
    // Extract R/G/B from 32-bit color 0xAABBGGRR
    static getR(i32) { return (i32 & 0xff) >>> 0; }
    static getG(i32) { return ((i32 >>> 8) & 0xff) >>> 0; }
    static getB(i32) { return ((i32 >>> 16) & 0xff) >>> 0; }

    // Compose a 32-bit RGBA color, forcing alpha=255
    static toRGBA32(r, g, b) {
        if (r < 0) r=0; else if (r>255) r=255;
        if (g < 0) g=0; else if (g>255) g=255;
        if (b < 0) b=0; else if (b>255) b=255;
        return (255 << 24) | (b << 16) | (g << 8) | r;
    }

    // Euclidean distance in [0..1]
    static distEuclidean(r0,g0,b0, r1,g1,b1) {
        let Pr=0.3, Pg=0.59, Pb=0.11;
        let rd=(r1-r0), gd=(g1-g0), bd=(b1-b0);
        let euclMax=Math.sqrt(Pr*255*255 + Pg*255*255 + Pb*255*255);
        let dist=Math.sqrt(Pr*rd*rd + Pg*gd*gd + Pb*bd*bd);
        return dist / euclMax;
    }

    // Manhattan distance in [0..1]
    static distManhattan(r0,g0,b0, r1,g1,b1) {
        let Pr=0.3, Pg=0.59, Pb=0.11;
        let rd=(r1-r0); if(rd<0) rd=-rd;
        let gd=(g1-g0); if(gd<0) gd=-gd;
        let bd=(b1-b0); if(bd<0) bd=-bd;
        let manhMax=(Pr+Pg+Pb)*255;
        return (Pr*rd + Pg*gd + Pb*bd)/manhMax;
    }

    static distCie76(r0,g0,b0, r1,g1,b1) {

        // 1) Convert RGB => Lab
        const [L1, a1, b1_] = rgb2lab(r0, g0, b0);
        const [L2, a2, b2_] = rgb2lab(r1, g1, b1);

        // 2) Compute ΔE* (CIE76)
        const dL = L2 - L1;
        const da = a2 - a1;
        const db = b2_ - b1_;
        const dist = Math.sqrt(dL*dL + da*da + db*db);

        // 3) Normalize (typical scale)
        return dist / 375.6;
    }

    // Basic skin-tone detection
    static isSkinTone(r,g,b) {
        let cb=-0.169*r -0.331*g +0.5*b +128;
        let cr= 0.5*r   -0.419*g -0.081*b+128;
        return (cb>=77 && cb<=127 && cr>=133 && cr<=173);
    }
}

////////////////////////////////////////////////////
// HueStats.js (optional hue grouping)
////////////////////////////////////////////////////
class HueStats {
    constructor(numGroups, minCols) {
        this.numGroups=numGroups>>>0;
        this.minCols=minCols>>>0;
        this.stats={};
        for(let i=-1; i<this.numGroups; i++){
            this.stats[i]={num:0, cols:[]};
        }
        this.groupsFull=0;
    }
    check(i32){
        if(this.groupsFull>=(this.numGroups+1)) return;
        let r=(i32&0xff),
            g=((i32>>>8)&0xff),
            b=((i32>>>16)&0xff);
        let hg=(r===g && g===b)
            ? -1
            : HueStats._hueGroup(HueStats._rgb2hsl(r,g,b).h,this.numGroups);
        let st=this.stats[hg];
        st.num++;
        if(st.num=== this.minCols) this.groupsFull++;
        if(st.num<= this.minCols){
            st.cols.push(i32>>>0);
        }
    }
    inject(histOrArr) {
        for(let i=-1; i<this.numGroups; i++){
            let st=this.stats[i];
            if(st.num<=this.minCols){
                // if it's an object
                if(HueStats._typeOf(histOrArr)==="Object"){
                    for(let c of st.cols){
                        if(histOrArr[c]===undefined){
                            histOrArr[c]=1;
                        } else {
                            histOrArr[c]++;
                        }
                    }
                } else if(HueStats._typeOf(histOrArr)==="Array"){
                    for(let c of st.cols){
                        if(histOrArr.indexOf(c)===-1) histOrArr.push(c);
                    }
                }
            }
        }
    }

    static _hueGroup(hue,segs){
        let seg=1/segs, half=seg/2;
        if(hue>=1-half|| hue<=half) return 0;
        for(let i=1; i<segs; i++){
            let mid=i*seg;
            if(hue>=mid-half && hue<=mid+half) return i;
        }
        return segs-1;
    }
    static _rgb2hsl(r,g,b){
        r/=255; g/=255; b/=255;
        let max=Math.max(r,g,b), min=Math.min(r,g,b);
        let l=(max+min)/2, h,s;
        if(max===min) { h=0; s=0;}
        else{
            let d=max-min;
            s=(l>0.5)?(d/(2-max-min)):(d/(max+min));
            switch(max){
                case r: h=(g-b)/d+(g<b?6:0); break;
                case g: h=(b-r)/d+2; break;
                case b: h=(r-g)/d+4; break;
            }
            h/=6;
        }
        return {h, s, l:HueStats._rgb2lum(r,g,b)};
    }
    static _rgb2lum(r,g,b){
        let Pr=0.3,Pg=0.59,Pb=0.11;
        return Math.sqrt(Pr*r*r + Pg*g*g + Pb*b*b);
    }
    static _typeOf(v){
        return Object.prototype.toString.call(v).slice(8,-1);
    }
}

////////////////////////////////////////////////////
// HistogramManager.js (Stores color->freq in an Object)
////////////////////////////////////////////////////
class HistogramManager {
    constructor(){
        // color32 => frequency
        this._hist= Object.create(null);
    }
    get histogram(){
        return this._hist;
    }
    incrementColor(i32, weight){
        let c=(i32>>>0);
        if(this._hist[c]===undefined){
            this._hist[c]=weight;
        } else {
            this._hist[c]+=weight;
        }
    }
}

////////////////////////////////////////////////////
// Palette.js (typed-array approach)
////////////////////////////////////////////////////
class Palette {
    constructor(maxColors){
        this._maxColors = maxColors>>>0;
        this._idxi32    = new Uint32Array(this._maxColors); // each color is 4 bytes RGBA
        this._i32idx    = {};
        this._used      = 0;
    }

    get maxColors(){ return this._maxColors; }
    get used(){ return this._used; }

    addColor(i32){
        // if we already have this color => return that index
        if(i32 in this._i32idx){
            return this._i32idx[i32];
        }
        // if no space => return -1
        let u=this._used;
        if(u>=this.maxColors){
            return -1;
        }
        let c=(i32>>>0);
        this._idxi32[u]= c;
        this._i32idx[c]= u;
        this._used= u+1;
        return u;
    }

    getColor32(index){
        return this._idxi32[index>>>0];
    }

    /**
     * nearestIndex => find the palette index for i32
     * using distFn(r0,g0,b0,r1,g1,b1)
     */
    nearestIndex(i32, distFn){
        let alpha=(i32>>>24)&0xFF;
        if(alpha===0) return -1;

        // if we stored it
        if(i32 in this._i32idx){
            return this._i32idx[i32];
        }

        let r0= ColorUtils.getR(i32),
            g0= ColorUtils.getG(i32),
            b0= ColorUtils.getB(i32);

        let best=-1, minDist=1e9;
        let used=this._used;
        for(let i=0; i<used; i++){
            let pal32=this._idxi32[i]>>>0;
            let r1=ColorUtils.getR(pal32), g1=ColorUtils.getG(pal32), b1=ColorUtils.getB(pal32);
            let d= distFn(r0,g0,b0, r1,g1,b1);
            if(d<minDist){
                minDist=d; best=i;
            }
        }
        return best;
    }
}

////////////////////////////////////////////////////
// Dither.js
////////////////////////////////////////////////////
class Dither {
    static getKernels(){
        return {
            FloydSteinberg: [
                [7 / 16, 1, 0],
                [3 / 16, -1, 1],
                [5 / 16, 0, 1],
                [1 / 16, 1, 1]
            ],
            FalseFloydSteinberg: [
                [3 / 8, 1, 0],
                [3 / 8, 0, 1],
                [2 / 8, 1, 1]
            ],
            Stucki: [
                [8 / 42, 1, 0],
                [4 / 42, 2, 0],
                [2 / 42, -2, 1],
                [4 / 42, -1, 1],
                [8 / 42, 0, 1],
                [4 / 42, 1, 1],
                [2 / 42, 2, 1],
                [1 / 42, -2, 2],
                [2 / 42, -1, 2],
                [4 / 42, 0, 2],
                [2 / 42, 1, 2],
                [1 / 42, 2, 2]
            ],
            Atkinson: [
                [1 / 8, 1, 0],
                [1 / 8, 2, 0],
                [1 / 8, -1, 1],
                [1 / 8, 0, 1],
                [1 / 8, 1, 1],
                [1 / 8, 0, 2]
            ],
            Jarvis: [			// Jarvis, Judice, and Ninke / JJN?
                [7 / 48, 1, 0],
                [5 / 48, 2, 0],
                [3 / 48, -2, 1],
                [5 / 48, -1, 1],
                [7 / 48, 0, 1],
                [5 / 48, 1, 1],
                [3 / 48, 2, 1],
                [1 / 48, -2, 2],
                [3 / 48, -1, 2],
                [5 / 48, 0, 2],
                [3 / 48, 1, 2],
                [1 / 48, 2, 2]
            ],
            Burkes: [
                [8 / 32, 1, 0],
                [4 / 32, 2, 0],
                [2 / 32, -2, 1],
                [4 / 32, -1, 1],
                [8 / 32, 0, 1],
                [4 / 32, 1, 1],
                [2 / 32, 2, 1],
            ],
            Sierra: [
                [5 / 32, 1, 0],
                [3 / 32, 2, 0],
                [2 / 32, -2, 1],
                [4 / 32, -1, 1],
                [5 / 32, 0, 1],
                [4 / 32, 1, 1],
                [2 / 32, 2, 1],
                [2 / 32, -1, 2],
                [3 / 32, 0, 2],
                [2 / 32, 1, 2],
            ],
            TwoSierra: [
                [4 / 16, 1, 0],
                [3 / 16, 2, 0],
                [1 / 16, -2, 1],
                [2 / 16, -1, 1],
                [3 / 16, 0, 1],
                [2 / 16, 1, 1],
                [1 / 16, 2, 1],
            ],
            SierraLite: [
                [2 / 4, 1, 0],
                [1 / 4, -1, 1],
                [1 / 4, 0, 1],
            ]
        };
    }

    static apply(buf32, w,h, quantizer, kernelName, serpentine, dithDelta){
        let kernels= Dither.getKernels();
        let kernel= kernels[kernelName];
        if(!kernel) throw new Error("Unknown dithering kernel: "+kernelName);

        let dir= serpentine? -1: 1;
        for(let y=0; y<h; y++){
            if(serpentine) dir= -dir;
            let lineBase=y*w;
            for(let x=(dir===1?0:w-1), xend=(dir===1?w:-1); x!==xend; x+=dir){
                let idx=(lineBase+x)>>>0;
                let old32= buf32[idx]>>>0;
                let r1= ColorUtils.getR(old32),
                    g1= ColorUtils.getG(old32),
                    b1= ColorUtils.getB(old32);

                // nearest palette color
                let nearIdx= quantizer.palette.nearestIndex(old32, quantizer._distFuncRaw);
                let new32= (nearIdx<0)? 0: quantizer.palette.getColor32(nearIdx)>>>0;
                buf32[idx]= new32;

                if(dithDelta>0){
                    let dist= quantizer._distFuncRaw(r1,g1,b1,
                        ColorUtils.getR(new32),
                        ColorUtils.getG(new32),
                        ColorUtils.getB(new32));
                    if(dist< dithDelta) {
                        continue; // skip error diffusion
                    }
                }

                // compute error
                let er=(r1-ColorUtils.getR(new32))|0;
                let eg=(g1-ColorUtils.getG(new32))|0;
                let eb=(b1-ColorUtils.getB(new32))|0;

                // scatter
                Dither._scatterError(buf32, w,h, x,y, er,eg,eb, kernel, dir);
            }
        }
    }

    static _scatterError(buf32, w,h, x,y, er,eg,eb, kernel, dir){
        for(let i=0; i<kernel.length; i++){
            let ds= kernel[i], factor=ds[0], ox=ds[1], oy=ds[2];
            let nx= x+ ox*dir, ny= y+ oy;
            if(nx<0||nx>=w) continue;
            if(ny<0||ny>=h) continue;

            let idx2= (ny*w + nx)>>>0;
            let c32= buf32[idx2]>>>0;
            let r3= ColorUtils.getR(c32), g3= ColorUtils.getG(c32), b3= ColorUtils.getB(c32);
            let r4= r3 + er*factor, g4= g3 + eg*factor, b4= b3 + eb*factor;
            if(r4<0)r4=0; else if(r4>255)r4=255;
            if(g4<0)g4=0; else if(g4>255)g4=255;
            if(b4<0)b4=0; else if(b4>255)b4=255;

            buf32[idx2]= ColorUtils.toRGBA32(r4|0,g4|0,b4|0)>>>0;
        }
    }
}

////////////////////////////////////////////////////
// Utility: getImageData, typeOf, makeBoxes, iterBox
////////////////////////////////////////////////////

/**
 * getImageData
 *  - Returns a uniform {buf8, buf32, width, height} from:
 *    - HTMLImageElement
 *    - Canvas / HTMLCanvasElement
 *    - CanvasRenderingContext2D
 *    - ImageData
 *    - raw typed arrays (Uint8Array, Uint8ClampedArray, Uint32Array, etc.)
 *    - an Array or CanvasPixelArray (for older browsers)
 *
 * If a 'width' argument is provided for raw typed arrays, that will be used;
 * otherwise, width is inferred from the total length (height = length / width).
 */
function getImageData(img, width) {
    var can, ctx, imgd, buf8, buf32, height;

    switch (typeOf(img)) {
        case "HTMLImageElement":
            can = document.createElement("canvas");
            can.width = img.naturalWidth;
            can.height = img.naturalHeight;
            ctx = can.getContext("2d");
            ctx.drawImage(img,0,0);
        case "Canvas":
        case "HTMLCanvasElement":
            can = can || img;
            ctx = ctx || can.getContext("2d");
        case "CanvasRenderingContext2D":
            ctx = ctx || img;
            can = can || ctx.canvas;
            imgd = ctx.getImageData(0, 0, can.width, can.height);
        case "ImageData":
            imgd = imgd || img;
            width = imgd.width;
            if (typeOf(imgd.data) == "CanvasPixelArray")
                buf8 = new Uint8Array(imgd.data);
            else
                buf8 = imgd.data;
        case "Array":
        case "CanvasPixelArray":
            buf8 = buf8 || new Uint8Array(img);
        case "Uint8Array":
        case "Uint8ClampedArray":
            buf8 = buf8 || img;
            buf32 = new Uint32Array(buf8.buffer);
        case "Uint32Array":
            buf32 = buf32 || img;
            buf8 = buf8 || new Uint8Array(buf32.buffer);
            width = width || buf32.length;
            height = buf32.length / width;
    }

    return {
        can: can,
        ctx: ctx,
        imgd: imgd,
        buf8: buf8,
        buf32: buf32,
        width: width,
        height: height,
    };
}

/**
 * Simple helper to identify the type of an object
 */
function typeOf(v){
    return Object.prototype.toString.call(v).slice(8,-1);
}
function makeBoxes(wid,hgt,w0,h0){
    let boxes=[];
    for(let y=0; y<hgt; y+=h0){
        for(let x=0; x<wid; x+=w0){
            let wRem=(x+w0>wid)? (wid-x):w0;
            let hRem=(y+h0>hgt)? (hgt-y):h0;
            boxes.push({x,y, w:wRem, h:hRem});
        }
    }
    return boxes;
}
function iterBox(box,wid,fn){
    let i0=box.y*wid+ box.x,
        i1=(box.y+ box.h-1)* wid+ (box.x+ box.w-1);
    let cnt=0, incr= wid- box.w+1;
    let i=i0;
    do {
        fn(i);
        cnt++;
        if((cnt%box.w)===0){
            i+= incr;
        } else {
            i++;
        }
    } while(i<= i1);
}

////////////////////////////////////////////////////
// HELPER SORT FUNCTIONS (from old RgbQuant code)
////////////////////////////////////////////////////
function isArrSortStable() {
    // test if the runtime's native Array#sort is stable
    const str = "abcdefghijklmnopqrstuvwxyz";
    const sorted = str.split("").sort((a,b) => {
        // artificially produce ties for items close in index
        return ~~(str.indexOf(b)/2.3) - ~~(str.indexOf(a)/2.3);
    }).join("");
    // A known result from an unstable sort test
    return (sorted === "xyzvwtursopqmnklhijfgdeabc") === false;
}

// must be used via stableSort.call(arr, compareFn)
function stableSort(compareFn) {
    // For primitive elements (Number, String), we also track original index
    // or for objects, we track them via .indexOf
    const type = Object.prototype.toString.call(this[0]).slice(8,-1);

    if (type === "Number" || type === "String") {
        const orderMap = {};
        const len = this.length;
        for (let i=0; i<len; i++) {
            const val = this[i];
            if (!(val in orderMap)) {
                orderMap[val] = i;
            }
        }
        return this.sort((a,b) => {
            const res = compareFn(a,b);
            return (res !== 0) ? res : (orderMap[a] - orderMap[b]);
        });
    } else {
        // fallback for object arrays
        const copy = this.slice(); // preserve original references
        return this.sort((a,b) => {
            const res = compareFn(a,b);
            if (res !== 0) return res;
            // stable fallback: compare their indexes in the original array
            return copy.indexOf(a) - copy.indexOf(b);
        });
    }
}

// For convenience, unify stable sorting into one variable
const Sort = isArrSortStable() ? Array.prototype.sort : stableSort;

// sortedHashKeys: returns keys of `obj` sorted by their values
function sortedHashKeys(obj, descending=true) {
    const keys = Object.keys(obj);
    // We’ll use stable or native sort with a custom comparator
    Sort.call(keys, (a,b) => {
        return descending
            ? (obj[b] - obj[a])
            : (obj[a] - obj[b]);
    });
    return keys;
}

////////////////////////////////////////////////////
// Finally: Quantizer.js with “reducePal” logic
////////////////////////////////////////////////////
class Quantizer {
    /**
     * @param {object} [opts]
     *   .method (1=global histogram, 2=subregion)
     *   .colors (max number of palette colors)
     *   .initColors (initial # of top colors to consider before grouping)
     *   .initDist (initial color distance threshold for merging)
     *   .distIncr (the amount to increment threshold each merge pass)
     *   .skinTonePreservation (0..1000 => multiplier for “skin” detection)
     *   .dist ( "euclidean" or "manhattan" )
     *   .boxSize ( [width, height] for subregion scanning )
     *   .boxPxls ( # of required repeats in a subregion )
     *   .hueGroups ( # of groups for optional HueStats )
     *   .minHueCols ( # of min. colors retained per group )
     */
    constructor(opts={}) {
        // Basic configuration
        this.method = opts.method || 1;
        this.colors = opts.colors || 256;
        this.initColors = opts.initColors || 2048;
        this.initDist = (typeof opts.initDist === 'number') ? opts.initDist : 0.05;
        this.distIncr = (typeof opts.distIncr === 'number') ? opts.distIncr : 0.005;

        // If >0 => extra weight for skin-tone colors
        this.skinTonePreservation = opts.skinTonePreservation || 20;

        // Distance function
        if(opts.dist === "cie76"){
            this._distFuncRaw = ColorUtils.distCie76;
        }else if (opts.dist === "manhattan"){
            this._distFuncRaw = ColorUtils.distManhattan;
        } else {
            this._distFuncRaw = ColorUtils.distEuclidean;
        }

        // Subregion partitioning
        this.boxSize = opts.boxSize || [64,64];
        this.boxPxls = opts.boxPxls || 2;

        // Optional hue grouping
        this.hueGroups = opts.hueGroups || 24;
        this.minHueCols = opts.minHueCols || 6;
        this._hueStats = null;
        if (this.minHueCols > 0 && this.hueGroups > 0){
            this._hueStats = new HueStats(this.hueGroups, this.minHueCols);
        }

        // For storing raw color frequencies
        this._histMgr = new HistogramManager();

        // Create a palette manager
        this.palette = new Palette(this.colors);

        // Indicate palette built?
        this._palBuilt = false;
    }

    /**
     * Sample an image (adds color frequencies to the histogram).
     * @param {*} img  (HTMLImageElement, Canvas, ImageData, TypedArray, etc.)
     * @param {number} [width] optional width for raw array data
     */
    sample(img, width) {
        if (this._palBuilt) {
            throw new Error("Cannot sample more images; palette is already built.");
        }
        const data = getImageData(img, width);

        if (this.method === 1) {
            this._colorStats1D(data.buf32);
        } else {
            this._colorStats2D(data.buf32, data.width, data.height);
        }
    }

    /**
     * Build the palette from the histogram.
     */
    buildPalette() {
        if (this._palBuilt) return;

        // 1) Gather histogram
        const histObj = this._histMgr.histogram;

        // 2) If we have HueStats, allow it to inject min-hue-colors
        if (this._hueStats) {
            this._hueStats.inject(histObj);
        }

        // 3) Sort color keys by descending frequency
        let keys = sortedHashKeys(histObj, true);

        // 4) Possibly trim to initColors, respecting tie frequencies
        if (keys.length > this.initColors) {
            const cutFreq = histObj[keys[this.initColors - 1]];
            let i = this.initColors;
            while (i < keys.length && histObj[keys[i]] === cutFreq) {
                i++;
            }
            keys = keys.slice(0, i);
        }

        // 5) If skinTonePreservation is > 0, re-weight those frequencies
        //    to further ensure they appear in the final palette
        if (this.skinTonePreservation>0) {
            for (const cStr of keys) {
                const c32 = parseInt(cStr,10)>>>0;
                const r= ColorUtils.getR(c32),
                    g= ColorUtils.getG(c32),
                    b= ColorUtils.getB(c32);
                if (ColorUtils.isSkinTone(r,g,b)) {
                    histObj[c32]+= histObj[c32] * (this.skinTonePreservation/100);
                }
            }
            // Re-sort after re-weight
            keys = sortedHashKeys(histObj, true);
        }

        // 6) Start building an internal array of candidate colors
        //    (like the old "idxi32" array)
        let candidates = [];
        for (const cStr of keys) {
            candidates.push( parseInt(cStr, 10)>>>0 );
        }

        // 7) Now do advanced grouping / merges until we have <= colors
        //    This mimics the old "reducePal()" approach.
        candidates = this._reducePalette(candidates);

        // 8) Insert final candidates into the palette
        for (const c32 of candidates) {
            const idx = this.palette.addColor(c32>>>0);
            if (idx < 0) break; // no more room
        }

        // Mark as built
        this._palBuilt = true;
    }

    /**
     * _reducePalette => merges similar colors until we have <= max palette
     */
    _reducePalette(candidates) {
        // If candidate list is already below the target, no need to merge
        if (candidates.length <= this.colors) return candidates;

        // Convert c32 -> [r,g,b]
        let colorRGBs = Uint32Array.from(candidates);

        let palLen = colorRGBs.length;
        let threshold = this.initDist;

        // Keep merging until we reduce to the final size
        while (palLen > this.colors) {
            // We'll track pairs that are closer than 'threshold'
            // and remove them from the array
            let mergedCount = 0;

            for (let i=0; i<colorRGBs.length; i++) {
                const rgbI = colorRGBs[i];
                if (!rgbI) continue; // already merged out

                for (let j=i+1; j<colorRGBs.length; j++) {
                    const rgbJ = colorRGBs[j];
                    if (!rgbJ) continue;

                    // Compare color distance
                    const dist = this._distFuncRaw(
                        ColorUtils.getR(rgbI),
                        ColorUtils.getG(rgbI),
                        ColorUtils.getB(rgbI),
                        ColorUtils.getR(rgbJ),
                        ColorUtils.getG(rgbJ),
                        ColorUtils.getB(rgbJ)
                    );
                    if (dist < threshold) {
                        // "merge" J into I => we can pick whichever
                        // but let's keep the more frequent color (if you track freq)
                        // or the first one
                        colorRGBs[j] = 0;
                        palLen--;
                        mergedCount++;
                    }
                }
            }

            // If we didn't merge anything, increase threshold
            // (this ensures we eventually reduce the set)
            if (mergedCount === 0) {
                threshold += this.distIncr;
            }
        }

        return colorRGBs;
    }

    /**
     * Reduce an image to the palette. Optionally apply dithering.
     * @param {*} img
     * @param {number} [retType=1]  => 1=Uint8Array, 2= array (JS)
     * @param {string} [dithKern]   => name of dithering kernel
     * @param {boolean} [dithSerp]
     * @param {number} [dithDelta]
     * @returns {Uint8Array|Array|Uint32Array}
     */
    reduce(img, retType, dithKern, dithSerp, dithDelta) {
        if (!this._palBuilt) {
            this.buildPalette();
        }
        const data = getImageData(img);
        const {buf32, width, height} = data;
        const len = buf32.length;

        if (dithKern) {
            // In-place dithering modifies buf32
            Dither.apply(buf32, width, height, this, dithKern, dithSerp, dithDelta);
        } else {
            // Map each pixel to nearest color
            for (let i=0; i<len; i++) {
                const cOld = buf32[i]>>>0;
                const idxNear = this.palette.nearestIndex(cOld, this._distFuncRaw);
                buf32[i] = (idxNear >= 0)
                    ? this.palette.getColor32(idxNear)
                    : 0; // or transparent
            }
        }

        // Return result in requested format
        if (retType===1) {
            // Convert final 32-bit color to palette index
            const out8 = new Uint8Array(len);
            for (let i=0; i<len; i++){
                const c32= buf32[i]>>>0;
                const idx = this.palette.nearestIndex(c32, this._distFuncRaw);
                out8[i] = (idx<0)? 0 : idx;
            }
            return out8;
        } else if (retType===2) {
            // Return as a plain JS array
            const out = [];
            for (let i=0; i<len; i++){
                const c32= buf32[i]>>>0;
                const idx = this.palette.nearestIndex(c32, this._distFuncRaw);
                out.push(idx<0? 0 : idx);
            }
            return out;
        }
        // or simply return the 32-bit buffer after mapping
        return buf32;
    }

    //-----------------------------------------
    // Internals for color counting
    //-----------------------------------------
    _colorStats1D(buf32) {
        const len=buf32.length;
        for(let i=0; i<len; i++){
            const c= buf32[i]>>>0;
            // skip alpha=0
            if(((c>>>24)&0xFF)===0) continue;

            // optionally track hueStats
            if(this._hueStats) {
                this._hueStats.check(c);
            }

            // increment histogram
            let weight=1;
            // extra weighting if isSkinTone
            const r= ColorUtils.getR(c),
                g= ColorUtils.getG(c),
                b= ColorUtils.getB(c);
            if(this.skinTonePreservation>0 && ColorUtils.isSkinTone(r,g,b)){
                weight += this.skinTonePreservation/100;
            }
            this._histMgr.incrementColor(c, weight);
        }
    }

    _colorStats2D(buf32, width, height) {
        const boxes = makeBoxes(width, height, this.boxSize[0], this.boxSize[1]);
        for(const box of boxes){
            const localHist={};
            // minimal repeats in subregion
            const thr= Math.max(
                Math.round((box.w*box.h)/(this.boxSize[0]*this.boxSize[1])) * this.boxPxls, 2
            );
            iterBox(box, width, (i)=>{
                const c= buf32[i]>>>0;
                if(((c>>>24)&0xFF)===0) return;

                if(this._hueStats) {
                    this._hueStats.check(c);
                }

                if(localHist[c] === undefined){
                    localHist[c] = 1;
                } else {
                    localHist[c]++;
                    // once local freq hits thr => qualifies globally
                    if(localHist[c]===thr){
                        this._histMgr.incrementColor(c, thr);
                    }
                }
            });
        }
    }
}

export default Quantizer;