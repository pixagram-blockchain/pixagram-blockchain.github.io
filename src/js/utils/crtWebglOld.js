const vertexShaderSrc = `#version 300 es
        in vec2 position;
        out vec2 vTexCoord;
        
        void main() {
            vTexCoord = (position + 1.0) * 0.5; // Convert from clip space to UV
            gl_Position = vec4(position, 0.0, 1.0);
        }
    `;

const fragmentShaderSrc = `#version 300 es
    precision highp float;
    
    uniform vec3 _uiResolution;
    uniform sampler2D _uiChannel0;
    
    in vec2 vTexCoord;
    out vec4 fragColor;
    
    float _uhardScan = -8.0;
    float _uhardPix = -3.0;
    vec2 _uwarp = vec2(0.03125, 0.0416666679);
    float _umaskDark = 0.5;
    float _umaskLight = 1.5;
    
    float _uToLinear1(in float _uc){
      return _uc <= 0.04045 ? (_uc / 12.92) : pow((_uc + 0.055) / 1.055, 2.4);
    }
    vec3 _uToLinear(in vec3 _uc){
      return vec3(_uToLinear1(_uc.r), _uToLinear1(_uc.g), _uToLinear1(_uc.b));
    }
    float _uToSrgb1(in float _uc){
      return _uc < 0.0031308 ? (_uc * 12.92) : (1.055 * pow(_uc, 1.0 / 2.4) - 0.055);
    }
    vec3 _uToSrgb(in vec3 _uc){
      return vec3(_uToSrgb1(_uc.r), _uToSrgb1(_uc.g), _uToSrgb1(_uc.b));
    }
    
    vec3 _uFetch(in vec2 _pos, in vec2 _off){
      vec2 p = floor((_pos * (_uiResolution.xy / 6.0)) + _off) / (_uiResolution.xy / 6.0);
      if (max(abs(p.x - 0.5), abs(p.y - 0.5)) > 0.5) return vec3(0.0);
      return _uToLinear(texture(_uiChannel0, p).rgb);
    }
    
    vec2 _uDist(in vec2 _pos){
      vec2 p = _pos * (_uiResolution.xy / 6.0);
      return -(p - floor(p) - vec2(0.5));
    }
    
    float _uGaus(float x, float scale){
      return exp2(scale * x * x);
    }
    
    vec3 _uHorz3(vec2 pos, float off){
      vec3 b = _uFetch(pos, vec2(-1.0, off));
      vec3 c = _uFetch(pos, vec2(0.0, off));
      vec3 d = _uFetch(pos, vec2(1.0, off));
      float dst = _uDist(pos).x;
      float wb = _uGaus(dst - 1.0, _uhardPix);
      float wc = _uGaus(dst, _uhardPix);
      float wd = _uGaus(dst + 1.0, _uhardPix);
      return (b * wb + c * wc + d * wd) / (wb + wc + wd);
    }
    
    vec3 _uHorz5(vec2 pos, float off){
      vec3 a = _uFetch(pos, vec2(-2.0, off));
      vec3 b = _uFetch(pos, vec2(-1.0, off));
      vec3 c = _uFetch(pos, vec2(0.0, off));
      vec3 d = _uFetch(pos, vec2(1.0, off));
      vec3 e = _uFetch(pos, vec2(2.0, off));
      float dst = _uDist(pos).x;
      float wa = _uGaus(dst - 2.0, _uhardPix);
      float wb = _uGaus(dst - 1.0, _uhardPix);
      float wc = _uGaus(dst, _uhardPix);
      float wd = _uGaus(dst + 1.0, _uhardPix);
      float we = _uGaus(dst + 2.0, _uhardPix);
      return (a * wa + b * wb + c * wc + d * wd + e * we) / (wa + wb + wc + wd + we);
    }
    
    float _uScan(vec2 pos, float off){
      float dst = _uDist(pos).y;
      return _uGaus(dst + off, _uhardScan);
    }
    
    vec3 _uTri(vec2 pos){
      vec3 a = _uHorz3(pos, -1.0);
      vec3 b = _uHorz5(pos,  0.0);
      vec3 c = _uHorz3(pos,  1.0);
      float wa = _uScan(pos, -1.0);
      float wb = _uScan(pos,  0.0);
      float wc = _uScan(pos,  1.0);
      return a * wa + b * wb + c * wc;
    }
    
    vec2 _uWarp(vec2 pos){
      pos = pos * 2.0 - 1.0;
      pos *= vec2(1.0 + pos.y * pos.y * _uwarp.x, 1.0 + pos.x * pos.x * _uwarp.y);
      return pos * 0.5 + 0.5;
    }
    
    vec3 _uMask(vec2 pos){
      pos.x += pos.y * 3.0;
      vec3 mask = vec3(_umaskDark);
      float frac = fract(pos.x / 6.0);
      if (frac < 0.333) mask.r = _umaskLight;
      else if (frac < 0.666) mask.g = _umaskLight;
      else mask.b = _umaskLight;
      return mask;
    }
    
    float _uBar(float pos, float bar){
      pos -= bar;
      return (pos * pos < 4.0) ? 0.0 : 1.0;
    }
    
   void main() {
  vec2 fragCoord = vTexCoord * _uiResolution.xy;
  vec4 fragColorLinear = vec4(0.0);

  // Treat the whole screen as View 3
  vec2 pos = _uWarp(fragCoord / _uiResolution.xy);

  _uhardScan = -12.0;
  _umaskDark = _umaskLight = 1.0;

  // Check if position is within valid texture bounds
  float alpha = 1.0;
  if (max(abs(pos.x - 0.5), abs(pos.y - 0.5)) > 0.5) {
    alpha = 0.0;
  }

  fragColorLinear.rgb = _uTri(pos) * _uMask(fragCoord.xy);
  fragColorLinear.a = alpha;

  fragColor = vec4(_uToSrgb(fragColorLinear.rgb), alpha);
}
    `;

export default (() => {
    let gl, canvas, program, positionBuffer, texLoc, resLoc;
    let texture;
    let isInitialized = false;
    let currentCanvasWidth = 0;
    let currentCanvasHeight = 0;

    function compileShader(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(s));
        }
        return s;
    }

    function initGLContext() {
        // Create canvas and context once
        canvas = new OffscreenCanvas(1, 1);
        gl = canvas.getContext("webgl2", {
            premultipliedAlpha: false,
            preserveDrawingBuffer: true
        });

        if (!gl) {
            throw new Error("WebGL2 not supported");
        }

        // Compile shaders once
        const vs = compileShader(gl.VERTEX_SHADER, vertexShaderSrc);
        const fs = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSrc);
        program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(program));
        }

        // Clean up shaders after linking
        gl.deleteShader(vs);
        gl.deleteShader(fs);

        gl.useProgram(program);

        // Create and setup position buffer once
        positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, +1, -1, -1, +1, -1, +1, +1, -1, +1, +1,
        ]), gl.STATIC_DRAW);

        const posLoc = gl.getAttribLocation(program, "position");
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        // Get uniform locations once
        texLoc = gl.getUniformLocation(program, "_uiChannel0");
        resLoc = gl.getUniformLocation(program, "_uiResolution");

        // Create texture once
        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        isInitialized = true;
    }

    function resizeCanvasIfNeeded(width, height) {
        if (currentCanvasWidth !== width || currentCanvasHeight !== height) {
            canvas.width = width;
            canvas.height = height;
            currentCanvasWidth = width;
            currentCanvasHeight = height;
            gl.viewport(0, 0, width, height);
        }
    }

    function crtUpscale(inputImageData, scaleN = 3) {
        const width = inputImageData.width;
        const height = inputImageData.height;
        const upscaleWidth = width * scaleN;
        const upscaleHeight = height * scaleN;

        // Initialize GL context on first call
        if (!isInitialized) {
            initGLContext();
        }

        // Resize canvas only if dimensions changed
        resizeCanvasIfNeeded(upscaleWidth, upscaleHeight);

        // Update texture data (texSubImage2D would be faster if size hasn't changed,
        // but texImage2D is simpler and handles size changes automatically)
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            width,
            height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            inputImageData.data
        );

        // Set uniforms
        gl.uniform1i(texLoc, 0);
        gl.uniform3f(resLoc, upscaleWidth, upscaleHeight, 1.0);

        // Draw
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Read pixels back
        const pixels = new Uint8ClampedArray(upscaleWidth * upscaleHeight * 4);
        gl.readPixels(0, 0, upscaleWidth, upscaleHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        return new ImageData(pixels, upscaleWidth, upscaleHeight);
    }

    return crtUpscale;
})();