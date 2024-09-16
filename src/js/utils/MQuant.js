class MQuant {
    constructor(options = {}) {
        this.colors = options.colors || 256;

        this.useCIELAB76 = options.useCIELAB76 || false; // Enable CIELAB76 distance if true

        // Initialize dependencies
        this.histogram = new Histogram();
        this.palette = new Palette(this.colors, this.useCIELAB76);
        this.colorDistance = new ColorDistance(this.useCIELAB76);
    }

    sample(imageData, width) {
        const data = this._getImageData(imageData, width);
        console.log('Sampling image data:', data);
        this.histogram.collect(data.buf32);
    }

    quantize(imageData) {
        if (!this.palette.isBuilt()) {
            console.log('Building palette from histogram...');
            this.palette.build(this.histogram);
            console.log('Built palette:', this.palette.colors);
        }

        return this._reduceColors(imageData);
    }

    _reduceColors(imageData) {
        const data = this._getImageData(imageData.data, imageData.width);
        const buf32 = data.buf32;
        const out32 = new Uint32Array(buf32.length);

        for (let i = 0; i < buf32.length; i++) {
            let newColor = this.palette.findNearestColor(buf32[i], this.colorDistance);
            newColor = (newColor | 0) >>> 0;
            out32[i] = newColor;
        }

        return new Uint8ClampedArray(out32.buffer);
    }

    _getImageData(imageData, width) {
        const buf8 = new Uint8Array(imageData);
        const buf32 = new Uint32Array(buf8.buffer);
        const height = buf8.length / (width * 4); // Fix to calculate height correctly
        return { buf32, width, height };
    }
}

class Histogram {
    constructor() {
        this.colorMap = new Map();
    }

    collect(buffer32) {
        const len = buffer32.length;
        for (let i = 0; i < len; i++) {
            let color = buffer32[i];
            color = (color | 0) >>> 0;
            if (this._isTransparent(color)) continue;
            this._incrementColor(color);
        }
        console.log('Collected histogram:', this.colorMap);
    }

    _incrementColor(color) {
        this.colorMap.set(color, (this.colorMap.get(color) || 0) + 1);
    }

    _isTransparent(color) {
        return ((color >> 24) & 0xff) === 0;
    }
}

class Palette {
    constructor(maxColors, useCIELAB76) {
        this.maxColors = maxColors;
        this.colors = new Uint32Array(maxColors);

        this.useCIELAB76 = useCIELAB76;
        this.colorMap = new Map();
        this._is_built = false;
    }

    build(histogram) {
        const sortedColors = Uint32Array.from(Array.from(histogram.colorMap.entries())
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]));

        let index = 0;
        const len = sortedColors.length;
        const step = Math.ceil(len / this.maxColors);

        // Select colors evenly distributed through the sorted list to ensure color diversity
        for (let i = 0; index < this.maxColors && i < len; i += step) {
            const color = sortedColors[i];
            this.colors[index++] = color;
        }

        this._buildIndex();
        this._is_built = true;
        console.log('Palette colors:', this.colors);
    }

    findNearestColor(color, distanceMetric) {
        color = (color | 0) >>> 0;
        let minDistance = Infinity;
        let bestMatch = 0;
        for (let i = 0; i < this.colors.length; i++) {
            const paletteColor = this.colors[i];
            const distance = distanceMetric.calculate(color, paletteColor);
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = (paletteColor | 0) >>> 0;
            }
        }
        return bestMatch;
    }

    isBuilt() {
        return this._is_built;
    }

    _buildIndex() {
        for (let i = 0; i < this.colors.length; i++) {
            this.colorMap.set(this.colors[i], i);
        }
    }
}

class ColorDistance {
    constructor(useCIELAB76) {
        this.useCIELAB76 = useCIELAB76;
    }

    calculate(color1, color2) {
        color1 = (color1 | 0) >>> 0;
        color2 = (color2 | 0) >>> 0;

        if (this.useCIELAB76) {
            return this._cielab76Distance(color1, color2);
        }
        return this._euclideanDistance(color1, color2);
    }

    _euclideanDistance(color1, color2) {
        color1 = (color1 | 0) >>> 0;
        color2 = (color2 | 0) >>> 0;
        const r1 = (color1 >> 16) & 0xff;
        const g1 = (color1 >> 8) & 0xff;
        const b1 = color1 & 0xff;
        const r2 = (color2 >> 16) & 0xff;
        const g2 = (color2 >> 8) & 0xff;
        const b2 = color2 & 0xff;
        const distance = Math.sqrt(
            0.3 * (r1 - r2) ** 2 +
            0.59 * (g1 - g2) ** 2 +
            0.11 * (b1 - b2) ** 2
        );
        return distance;
    }

    _cielab76Distance(color1, color2) {
        // Convert RGB to CIELAB and calculate Delta E
        color1 = (color1 | 0) >>> 0;
        color2 = (color2 | 0) >>> 0;
        const lab1 = this._rgbToLab(color1);
        const lab2 = this._rgbToLab(color2);
        const deltaL = lab1[0] - lab2[0];
        const deltaA = lab1[1] - lab2[1];
        const deltaB = lab1[2] - lab2[2];
        const distance = Math.sqrt(deltaL ** 2 + deltaA ** 2 + deltaB ** 2);
        return distance;
    }

    _rgbToLab(color) {
        // Convert RGB to XYZ
        color = (color | 0) >>> 0;
        const r = ((color >> 16) & 0xff) / 255;
        const g = ((color >> 8) & 0xff) / 255;
        const b = (color & 0xff) / 255;

        const [xr, yr, zr] = [
            r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92,
            g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92,
            b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92,
        ];

        const X = xr * 0.4124 + yr * 0.3576 + zr * 0.1805;
        const Y = xr * 0.2126 + yr * 0.7152 + zr * 0.0722;
        const Z = xr * 0.0193 + yr * 0.1192 + zr * 0.9505;

        // Convert XYZ to LAB
        const [xrNorm, yrNorm, zrNorm] = [X / 0.95047, Y / 1.00000, Z / 1.08883].map(
            v => (v > 0.008856 ? Math.cbrt(v) : (v * 7.787) + (16 / 116))
        );

        const L = (116 * yrNorm) - 16;
        const A = 500 * (xrNorm - yrNorm);
        const B = 200 * (yrNorm - zrNorm);

        return [L, A, B];
    }
}

module.exports = MQuant;