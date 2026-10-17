var vo=Object.defineProperty;var xo=(e,t,o)=>t in e?vo(e,t,{enumerable:!0,configurable:!0,writable:!0,value:o}):e[t]=o;var E=(e,t,o)=>xo(e,typeof t!="symbol"?t+"":t,o);import"./modulepreload-polyfill-B5Qt9EMX.js";function mo(e){const t=e.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1,premultipliedAlpha:!0,preserveDrawingBuffer:!1,powerPreference:"high-performance"});return!t||!(t.getExtension("EXT_color_buffer_float")||t.getExtension("EXT_color_buffer_half_float"))?null:(t.getExtension("OES_texture_float_linear"),t)}function Pt(e,t,o){const a=e.createShader(t);if(e.shaderSource(a,o),e.compileShader(a),!e.getShaderParameter(a,e.COMPILE_STATUS)){const i=e.getShaderInfoLog(a),s=o.split(`
`).map((f,u)=>`${u+1}: ${f}`).join(`
`);throw new Error(`shader: ${i}
${s}`)}return a}class R{constructor(t,o,a){E(this,"prog");E(this,"u",new Map);this.gl=t;const i=t.createProgram();if(t.attachShader(i,Pt(t,t.VERTEX_SHADER,o)),t.attachShader(i,Pt(t,t.FRAGMENT_SHADER,a)),t.bindAttribLocation(i,0,"aPos"),t.linkProgram(i),!t.getProgramParameter(i,t.LINK_STATUS))throw new Error(`link: ${t.getProgramInfoLog(i)}`);this.prog=i;const s=t.getProgramParameter(i,t.ACTIVE_UNIFORMS);for(let f=0;f<s;f++){const u=t.getActiveUniform(i,f),l=u.name.replace(/\[0\]$/,""),w=t.getUniformLocation(i,u.name);w&&this.u.set(l,w)}}use(){return this.gl.useProgram(this.prog),this}f(t,...o){const a=this.u.get(t);if(!a)return this;const i=this.gl;return o.length===1?i.uniform1f(a,o[0]):o.length===2?i.uniform2f(a,o[0],o[1]):o.length===3?i.uniform3f(a,o[0],o[1],o[2]):i.uniform4f(a,o[0],o[1],o[2],o[3]),this}fv(t,o,a){const i=this.u.get(t);return i?(a===2?this.gl.uniform2fv(i,o):this.gl.uniform4fv(i,o),this):this}i(t,o){const a=this.u.get(t);return a&&this.gl.uniform1i(a,o),this}tex(t,o,a){const i=this.gl;return i.activeTexture(i.TEXTURE0+o),i.bindTexture(i.TEXTURE_2D,a),this.i(t,o)}}function ae(e,t,o,a,i,s,f=!1){const u=e.createTexture();e.bindTexture(e.TEXTURE_2D,u),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,f?e.LINEAR_MIPMAP_LINEAR:e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,a,t,o,0,i,s,null),f&&e.generateMipmap(e.TEXTURE_2D);const l=e.createFramebuffer();return e.bindFramebuffer(e.FRAMEBUFFER,l),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,u,0),e.viewport(0,0,t,o),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.bindFramebuffer(e.FRAMEBUFFER,null),{tex:u,fb:l,w:t,h:o,mips:f}}function Re(e,t){e.deleteTexture(t.tex),e.deleteFramebuffer(t.fb)}class ze{constructor(t){E(this,"read");E(this,"write");this.read=t(),this.write=t()}swap(){const t=this.read;this.read=this.write,this.write=t}get w(){return this.read.w}get h(){return this.read.h}}function ne(e){return new Promise((t,o)=>{const a=new Image;a.decoding="async",a.onload=()=>t(a),a.onerror=()=>o(new Error(`image: ${e}`)),a.src=e})}function ue(e,t,o){const a=e.createTexture();e.bindTexture(e.TEXTURE_2D,a),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,o),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,e.RGBA,e.UNSIGNED_BYTE,t),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR_MIPMAP_LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.generateMipmap(e.TEXTURE_2D);const i=e.getExtension("EXT_texture_filter_anisotropic");return i&&e.texParameterf(e.TEXTURE_2D,i.TEXTURE_MAX_ANISOTROPY_EXT,4),{tex:a,w:t.width,h:t.height}}function po(e){const t=e.createVertexArray();e.bindVertexArray(t);const o=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,o),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0);const a=e.createVertexArray();e.bindVertexArray(a);const i=e.createBuffer();return e.bindBuffer(e.ARRAY_BUFFER,i),e.bufferData(e.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),e.bindVertexArray(null),{full(){e.bindVertexArray(t),e.drawArrays(e.TRIANGLES,0,3)},quad(){e.bindVertexArray(a),e.drawArrays(e.TRIANGLE_STRIP,0,4)}}}const Ie=8,N=`#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`,xe=`#version 300 es
in vec2 aPos;
uniform vec4 uRect;
out vec2 vUv;
void main() {
  vec2 p = mix(uRect.xy, uRect.zw, aPos);
  vUv = vec2(aPos.x, 1.0 - aPos.y);
  gl_Position = vec4(p, 0.0, 1.0);
}`,$=`#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 o;
`,Oe=`
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx) * 2.0 - 1.0;
}
float gnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(hash33(i), f);
  float b = dot(hash33(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0));
  float c = dot(hash33(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0));
  float d = dot(hash33(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0));
  float e = dot(hash33(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0));
  float g = dot(hash33(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0));
  float h = dot(hash33(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0));
  float k = dot(hash33(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`,Wt=`
uniform vec2 uPath[${Ie}];
uniform int uPathN;
uniform float uAspect;
vec4 pathAt(vec2 uv, float width) {
  vec2 p = vec2(uv.x * uAspect, uv.y);
  float best = 1e9;
  float along = 0.0;
  vec2 dir = vec2(0.0);
  float total = 0.0;
  float run = 0.0;
  for (int i = 0; i < ${Ie-1}; i++) {
    if (i >= uPathN - 1) break;
    vec2 a = vec2(uPath[i].x * uAspect, uPath[i].y);
    vec2 b = vec2(uPath[i + 1].x * uAspect, uPath[i + 1].y);
    total += length(b - a);
  }
  for (int i = 0; i < ${Ie-1}; i++) {
    if (i >= uPathN - 1) break;
    vec2 a = vec2(uPath[i].x * uAspect, uPath[i].y);
    vec2 b = vec2(uPath[i + 1].x * uAspect, uPath[i + 1].y);
    vec2 ba = b - a;
    float len = length(ba);
    float h = clamp(dot(p - a, ba) / max(len * len, 1e-6), 0.0, 1.0);
    float d = length(p - a - ba * h);
    float w = exp(-d * d / (width * width * 0.6));
    dir += (ba / max(len, 1e-6)) * (w + 1e-4);
    if (d < best) { best = d; along = (run + h * len) / max(total, 1e-6); }
    run += len;
  }
  return vec4(best, along, normalize(dir + 1e-6));
}
`,yo=`${$}
uniform sampler2D uVel;
uniform vec2 uTexel;
void main() {
  float L = texture(uVel, vUv - vec2(uTexel.x, 0.0)).y;
  float R = texture(uVel, vUv + vec2(uTexel.x, 0.0)).y;
  float B = texture(uVel, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uVel, vUv + vec2(0.0, uTexel.y)).x;
  o = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,wo=`${$}
${Oe}
${Wt}
uniform sampler2D uVel;
uniform sampler2D uCurl;
uniform sampler2D uSolid;
uniform vec2 uTexel;
uniform float uDt;
uniform float uConfine;
uniform float uRelax;
uniform float uStir;
uniform float uTime;
uniform vec2 uDrift;
uniform float uWidth;
uniform float uSpeed;
void main() {
  float L = abs(texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x);
  float R = abs(texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x);
  float B = abs(texture(uCurl, vUv - vec2(0.0, uTexel.y)).x);
  float T = abs(texture(uCurl, vUv + vec2(0.0, uTexel.y)).x);
  float C = texture(uCurl, vUv).x;
  vec2 f = 0.5 * vec2(T - B, R - L);
  f /= length(f) + 1e-5;
  f *= uConfine * C;
  f.y = -f.y;
  vec2 v = texture(uVel, vUv).xy + f * uDt;

  // The room's own slow stir: the curl of a drifting noise potential, so it only turns the air.
  vec2 q = vec2(vUv.x * uAspect, vUv.y) * 2.4;
  const float e = 0.02;
  float tz = uTime * 0.045;
  float nx1 = gnoise(vec3(q + vec2(e, 0.0), tz)), nx0 = gnoise(vec3(q - vec2(e, 0.0), tz));
  float ny1 = gnoise(vec3(q + vec2(0.0, e), tz)), ny0 = gnoise(vec3(q - vec2(0.0, e), tz));
  v += vec2(ny1 - ny0, -(nx1 - nx0)) / (2.0 * e) * uStir * uDt;

  // The current.
  vec4 pa = pathAt(vUv, uWidth);
  float jet = exp(-pa.x * pa.x / (uWidth * uWidth));
  vec2 target = uDrift + pa.zw * uSpeed * jet;
  v = target + (v - target) * uRelax;

  v *= 1.0 - texture(uSolid, vUv).r;
  o = vec4(v, 0.0, 1.0);
}`,To=`${$}
uniform sampler2D uVel;
uniform sampler2D uSolid;
uniform vec2 uTexel;
void main() {
  vec2 dx = vec2(uTexel.x, 0.0), dy = vec2(0.0, uTexel.y);
  float L = texture(uVel, vUv - dx).x * (1.0 - texture(uSolid, vUv - dx).r);
  float R = texture(uVel, vUv + dx).x * (1.0 - texture(uSolid, vUv + dx).r);
  float B = texture(uVel, vUv - dy).y * (1.0 - texture(uSolid, vUv - dy).r);
  float T = texture(uVel, vUv + dy).y * (1.0 - texture(uSolid, vUv + dy).r);
  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,bo=`${$}
uniform sampler2D uP;
uniform sampler2D uDiv;
uniform sampler2D uSolid;
uniform vec2 uTexel;
void main() {
  vec2 dx = vec2(uTexel.x, 0.0), dy = vec2(0.0, uTexel.y);
  float c = texture(uP, vUv).x;
  float L = mix(texture(uP, vUv - dx).x, c, texture(uSolid, vUv - dx).r);
  float R = mix(texture(uP, vUv + dx).x, c, texture(uSolid, vUv + dx).r);
  float B = mix(texture(uP, vUv - dy).x, c, texture(uSolid, vUv - dy).r);
  float T = mix(texture(uP, vUv + dy).x, c, texture(uSolid, vUv + dy).r);
  o = vec4((L + R + B + T - texture(uDiv, vUv).x) * 0.25, 0.0, 0.0, 1.0);
}`,Eo=`${$}
uniform sampler2D uP;
uniform sampler2D uVel;
uniform sampler2D uSolid;
uniform vec2 uTexel;
void main() {
  vec2 dx = vec2(uTexel.x, 0.0), dy = vec2(0.0, uTexel.y);
  float c = texture(uP, vUv).x;
  float L = mix(texture(uP, vUv - dx).x, c, texture(uSolid, vUv - dx).r);
  float R = mix(texture(uP, vUv + dx).x, c, texture(uSolid, vUv + dx).r);
  float B = mix(texture(uP, vUv - dy).x, c, texture(uSolid, vUv - dy).r);
  float T = mix(texture(uP, vUv + dy).x, c, texture(uSolid, vUv + dy).r);
  vec2 v = texture(uVel, vUv).xy - 0.5 * vec2(R - L, T - B);
  v *= 1.0 - texture(uSolid, vUv).r;
  o = vec4(v, 0.0, 1.0);
}`,Ao=`${$}
uniform sampler2D uSrc;
uniform float uK;
void main() { o = texture(uSrc, vUv) * uK; }`,So=`${$}
uniform sampler2D uVel;
uniform sampler2D uSrc;
uniform sampler2D uSolid;
uniform vec2 uVelTexel;
uniform float uDt;
uniform float uKeep;
uniform vec3 uWarp;
uniform vec2 uShift;
uniform float uFloor;
void main() {
  vec2 p = uWarp.xy + (vUv - uWarp.xy) * uWarp.z + uShift;
  vec2 v = texture(uVel, p).xy;
  vec2 back = p - uDt * v * uVelTexel;
  vec4 s = texture(uSrc, back);
  // Outside last frame's screen there was nothing to carry in.
  vec2 inside = step(vec2(0.0), back) * step(back, vec2(1.0));
  s *= mix(uFloor, 1.0, inside.x * inside.y);
  o = s * uKeep * (1.0 - texture(uSolid, vUv).r);
}`,Po=`${$}
${Oe}
${Wt}
uniform sampler2D uSrc;
uniform sampler2D uSolid;
uniform float uWidth;
uniform float uAmount;
uniform float uCeil;
uniform float uTime;
uniform float uDt;
void main() {
  vec4 s = texture(uSrc, vUv);
  vec4 pa = pathAt(vUv, uWidth);
  float core = exp(-pa.x * pa.x / (uWidth * uWidth * 0.28));
  vec2 q = vec2(vUv.x * uAspect, vUv.y);
  float fil = gnoise(vec3(q * 9.0 - pa.zw * uTime * 0.9, uTime * 0.21));
  float breath = gnoise(vec3(pa.y * 3.2 - uTime * 0.16, 2.3, uTime * 0.07));
  float add = uAmount * uDt * core * smoothstep(-0.05, 0.45, fil) * smoothstep(-0.35, 0.25, breath);
  s.r = max(s.r, min(s.r + add, uCeil));
  s *= 1.0 - texture(uSolid, vUv).r;
  o = s;
}`,go=`${$}
uniform sampler2D uSrc;
uniform vec2 uPoint;
uniform vec4 uValue;
uniform float uRadius;
uniform float uAspect;
void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  float g = exp(-dot(p, p) / uRadius);
  o = texture(uSrc, vUv) + uValue * g;
}`,Ro=`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
void main() {
  float a = texture(uTex, vUv).a;
  o = vec4(smoothstep(0.3, 0.7, a));
}`,Uo=`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform vec2 uSize;
uniform float uFar;
uniform float uNear;
uniform vec4 uPed;
uniform float uExposure;
uniform vec3 uTint;
uniform float uTintK;
void main() {
  vec2 px = vUv * uSize;
  float above = 1.0 - smoothstep(uPed.y - 70.0, uPed.y + 6.0, px.y);
  float below = smoothstep(uPed.w, uSize.y, px.y);
  float beside = smoothstep(0.0, 140.0, max(uPed.x - px.x, px.x - uPed.z));
  float lod = max(max(uFar * above, uNear * below), uFar * 0.4 * beside * (1.0 - above));
  vec3 c = vec3(0.0);
  float rad = (exp2(lod) - 1.0) * 1.5;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 2.39996;
    float rr = sqrt((float(i) + 0.5) / 12.0);
    vec2 off = vec2(cos(a), sin(a)) * rr * rad / uSize;
    c += textureLod(uTex, vUv + off, lod).rgb;
  }
  c = c / 12.0 * uExposure;
  // A gentle grade toward the room's own lilac.
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, uTint * (l / max(dot(uTint, vec3(0.299, 0.587, 0.114)), 1e-3)), uTintK);
  o = vec4(c, 1.0);
}`,Fo=`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform float uLod;
uniform float uAlpha;
uniform vec4 uPool;
uniform float uPoolK;
// The label's band photographed at three times the detail, for the close reads: its top and bottom (in the
// cutout's uv) and how much of it to use.
uniform sampler2D uPatch;
uniform vec2 uPatchY;
uniform float uPatchK;
// The patch's own mip level at this magnification.
uniform float uPatchLod;
void main() {
  vec4 c = uLod > 0.01 ? textureLod(uTex, vUv, uLod) : texture(uTex, vUv);
  if (uPatchK > 0.0) {
    float py = (vUv.y - uPatchY.x) / (uPatchY.y - uPatchY.x);
    // The same defocus as the photograph under it (uLod), in the patch's three-times-finer pixels.
    float lod = max(uPatchLod, log2(1.0 + 3.0 * (exp2(uLod) - 1.0)));
    vec4 h = textureLod(uPatch, vec2(vUv.x, clamp(py, 0.0, 1.0)), lod);
    // Eased in over the band's first and last rows, on the glass above and below the label, so its edges never show.
    c = mix(c, h, smoothstep(0.0, 0.03, py) * (1.0 - smoothstep(0.97, 1.0, py)) * uPatchK);
  }
  vec2 d = (vUv - uPool.xy) / uPool.zw;
  float pool = 1.0 - smoothstep(0.6, 1.25, length(d));
  c.rgb *= mix(1.0 - uPoolK, 1.0, pool);
  o = c * uAlpha;
}`,Do=`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform float uAlpha;
uniform vec3 uColor;
void main() {
  vec2 d = (vUv - 0.5) * 2.0;
  float r = length(d);
  float a = 1.0 - smoothstep(0.0, 1.0, r);
  a = a * a * (0.6 + 0.4 * (1.0 - smoothstep(0.0, 0.45, r)));
  a *= uAlpha;
  o = vec4(uColor * a, a);
}`,_o=`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
${Oe}
uniform sampler2D uTex;
uniform vec2 uTexSize;
uniform vec2 uPad;
uniform float uScale;
uniform vec4 uFocus;
uniform vec2 uFall;
uniform float uBlur;
uniform float uDefocus;
uniform vec4 uFog;
uniform float uFogWander;
uniform float uTime;
uniform float uAlpha;
uniform vec3 uTint;
uniform float uTintK;
void main() {
  vec2 uv = vUv * (1.0 + 2.0 * uPad) - uPad;
  // Sharp where the camera reads, softening with distance from it the way a close lens focuses.
  vec2 d = max(max(uFocus.xy - gl_FragCoord.xy, gl_FragCoord.xy - uFocus.zw), 0.0) / uFall;
  float r = (uBlur * smoothstep(0.0, 1.0, length(d)) + uDefocus) / uScale;
  float base = max(0.0, -log2(uScale));
  vec3 col;
  if (r < 0.75) {
    col = textureLod(uTex, uv, base).rgb;
  } else {
    // A disc of taps, turned at random per pixel so a wide blur reads as grain rather than blocks.
    float lod = max(base, log2(r * 0.45));
    float turn = hash12(gl_FragCoord.xy) * 6.28318;
    col = vec3(0.0);
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 2.39996 + turn;
      float rr = sqrt((float(i) + 0.5) / 12.0);
      col += textureLod(uTex, clamp(uv + vec2(cos(a), sin(a)) * rr * r / uTexSize, 0.0, 1.0), lod).rgb;
    }
    col /= 12.0;
  }
  // The sheet's edges, softened by the defocus alone.
  vec2 e = min(uv, 1.0 - uv) * uTexSize * uScale;
  float soft = max(uDefocus, 0.5);
  float cover = smoothstep(-soft, soft, e.x) * smoothstep(-soft, soft, e.y);
  // The window's light falls across it from the top left, and the room's lilac settles into the paper.
  float fall = smoothstep(0.0, 1.0, dot(clamp(uv, 0.0, 1.0), vec2(0.45, 0.55)));
  col *= 1.0 - 0.07 * fall;
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, uTint * (l / max(dot(uTint, vec3(0.299, 0.587, 0.114)), 1e-3)), uTintK * (0.5 + 0.5 * fall));
  // Where the mist stands in front of it, the sheet goes into the mist along a wandering edge.
  vec2 fp = gl_FragCoord.xy;
  float wander = uFogWander * gnoise(vec3(fp * 0.0025, uTime * 0.06));
  float al = cover * uAlpha * smoothstep(uFog.z, uFog.w, dot(fp, uFog.xy) + wander);
  o = vec4(col * al, al);
}`,Lo=`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform vec2 uSize;
uniform vec3 uBox;
uniform float uAlpha;
uniform vec3 uColor;
void main() {
  vec2 p = (vUv - 0.5) * uSize;
  vec2 d = abs(p) - uBox.xy;
  float sd = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  float a = 1.0 - smoothstep(-uBox.z, uBox.z, sd);
  a = a * a * uAlpha;
  o = vec4(uColor * a, a);
}`,ko=`${$}
uniform sampler2D uVel;
uniform sampler2D uDisp;
uniform vec2 uVelTexel;
uniform float uDt;
uniform float uKeep;
uniform vec3 uWarp;
uniform vec2 uShift;
void main() {
  vec2 p = uWarp.xy + (vUv - uWarp.xy) * uWarp.z + uShift;
  vec2 v = texture(uVel, p).xy;
  vec2 back = p - uDt * v * uVelTexel;
  vec2 d = texture(uDisp, back).xy;
  o = vec4(d * uKeep + v * uVelTexel * uDt, 0.0, 1.0);
}`,Mo=`#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 o;
${Oe}
uniform sampler2D uDye;
uniform vec2 uDyeTexel;
uniform float uLod;
uniform float uDensity;
uniform float uBump;
uniform vec2 uLight;
uniform vec3 uLit;
uniform vec3 uShade;
uniform float uTime;
uniform float uAspect;
uniform sampler2D uSilk;
uniform vec4 uSilkRect;
uniform float uSilkK;
uniform float uSilkLod;
uniform vec2 uFlow;
uniform float uCycle;
uniform sampler2D uDisp;
uniform float uDispK;
uniform sampler2D uMask;
uniform vec4 uMaskRect;
uniform vec4 uMaskInner;
uniform float uMaskOn;
uniform float uDyeK;
uniform vec4 uClear;
uniform float uVeil;
uniform float uVeilK;
uniform vec2 uVeilC;
uniform vec2 uBank;
uniform float uBankX;
uniform vec4 uOcc;
uniform float uOccK;
uniform vec4 uPuff;
uniform vec2 uPuffFlow;

float maskIn(vec4 r, vec2 uv) {
  vec2 m = vec2((uv.x - r.x) / (r.z - r.x), (r.w - uv.y) / (r.w - r.y));
  vec2 inside = step(vec2(0.0), m) * step(m, vec2(1.0));
  // A fixed level: an automatic one jumps to the blurriest at the rectangle's edge and draws a line there.
  return textureLod(uMask, clamp(m, 0.0, 1.0), 1.0).a * inside.x * inside.y;
}
/* In front of the glass the silk shows only along its edges. */
float frontMask(vec2 uv) {
  return maskIn(uMaskRect, uv) * (1.0 - maskIn(uMaskInner, uv));
}
float veilAt(vec2 uv) {
  if (uVeilK <= 0.0) return 0.0;
  vec2 q = vec2((uv.x - uVeilC.x) * uAspect, uv.y - uVeilC.y);
  float front = length(q) + 0.22 * gnoise(vec3(uv * vec2(uAspect, 1.0) * 2.6, uTime * 0.12));
  float v = smoothstep(uVeil - 0.4, uVeil + 0.05, front);
  float grain = 0.7 + 0.6 * gnoise(vec3(uv * vec2(uAspect, 1.0) * 4.5 + vec2(uTime * 0.02, -uTime * 0.035), 1.3));
  return v * grain * uVeilK;
}
/* Mist settling along the foot of the screen: the ground the words stand on while the camera reads the label.
   uBank: how much, and how high its top edge reaches (screen uv). */
float bankAt(vec2 uv) {
  if (uBank.x <= 0.0) return 0.0;
  float edge = uBank.y + 0.05 * gnoise(vec3(uv.x * uAspect * 2.2 + uTime * 0.05, uTime * 0.07, 4.1));
  float body = 1.0 - smoothstep(edge - 0.2, edge + 0.03, uv.y);
  // Thickest at the foot of the screen, so print behind the captions never peeks out beneath them.
  body *= 1.0 + 1.2 * (1.0 - smoothstep(0.0, 0.16, uv.y));
  // On a wide screen it gathers under the words on the left.
  body *= 1.0 - smoothstep(uBankX - 0.2, uBankX + 0.04, uv.x + 0.05 * gnoise(vec3(uv.y * 3.0, uTime * 0.05, 2.2)));
  float grain = 0.82 + 0.36 * gnoise(vec3(uv * vec2(uAspect, 1.0) * 6.0 + vec2(uTime * 0.03, uTime * 0.012), 7.7));
  return body * grain * uBank.x;
}
/* Where a vial gives way to the next, a puff of mist around it: uPuff is its centre (screen uv), its radius (in
   screen heights) and how much; uPuffFlow, how far through it the scroll is (-1..1) and which puff it is. The puff
   rises as it passes. */
vec2 puffQ(vec2 uv) {
  vec2 q = vec2((uv.x - uPuff.x) * uAspect, uv.y - uPuff.y) / uPuff.z;
  return q - vec2(0.0, 0.18 * uPuffFlow.x);
}
float puffBody(vec2 q) {
  float n = gnoise(vec3(q * 1.5 + vec2(0.0, -uTime * 0.12), uTime * 0.1 + uPuffFlow.y));
  return 1.0 - smoothstep(0.5, 1.15, length(q * vec2(1.2, 0.8)) + 0.4 * n);
}
float puffAt(vec2 uv) {
  if (uPuff.w <= 0.0) return 0.0;
  vec2 q = puffQ(uv);
  float grain = 0.72 + 0.56 * gnoise(vec3(q * 3.4 + vec2(uTime * 0.04, -uTime * 0.22), 5.1));
  return puffBody(q) * grain * uPuff.w;
}
float dyeAt(vec2 uv) {
  return textureLod(uDye, uv, uLod).r * uDyeK;
}
/* A sample of the photographed air as light: its colour, and how much of the room behind it it veils. Shot against
   black, it composites like a screen print over the room. Its shaded folds lean to the room's lilac. */
vec4 silkInk(vec3 c) {
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 col = mix(c, uShade * l * 1.1, 0.35 * (1.0 - smoothstep(0.2, 0.7, l)));
  return vec4(col * 1.06, smoothstep(0.03, 0.8, l));
}
/* The same photographed air streaming across the vial in the puff: two layers of it, the second turned half round,
   both rising, one bearing right and one left, so for a moment the glass is behind smoke. */
vec4 puffSilk(vec2 uv) {
  if (uPuff.w <= 0.0) return vec4(0.0);
  vec2 q = puffQ(uv);
  float body = puffBody(q);
  if (body <= 0.0) return vec4(0.0);
  float p = uPuffFlow.x;
  // Each puff takes the smoke from a different part of the photograph.
  vec2 c0 = vec2(0.42, 0.6) + 0.07 * vec2(sin(uPuffFlow.y * 2.3), cos(uPuffFlow.y * 1.7));
  vec2 qa = q - vec2(0.85, 0.5) * p, qb = q - vec2(-0.7, 0.45) * p;
  vec4 a = silkInk(textureLod(uSilk, c0 + vec2(qa.x, -qa.y) * 0.3, 0.0).rgb);
  vec4 b = silkInk(textureLod(uSilk, c0 + vec2(0.06, -0.05) + vec2(-qb.x, qb.y) * 0.24, 0.0).rgb);
  vec4 s = a + (1.0 - a.a) * b;
  return s * body * uPuff.w;
}
vec4 silkAt(vec2 uv) {
  if (uSilkK <= 0.0) return vec4(0.0);
  vec2 q = uv - texture(uDisp, uv).xy * uDispK;
  vec2 m = vec2((q.x - uSilkRect.x) / (uSilkRect.z - uSilkRect.x), (uSilkRect.w - q.y) / (uSilkRect.w - uSilkRect.y));
  // It breathes: a slow, smooth swell of the whole sheet.
  float bt = uTime * 0.06;
  m += 0.006 * vec2(gnoise(vec3(m * 2.2, bt)), gnoise(vec3(m * 2.2 + 5.2, bt + 1.7)));
  // And drifts along the current, in two phases crossfaded so it never visibly resets. The drift varies across the
  // sheet so it reads as flow, not a slide.
  vec2 flow = uFlow * (0.7 + 0.6 * gnoise(vec3(m * 2.5, 0.7)));
  float p0 = uCycle;
  float p1 = fract(uCycle + 0.5);
  vec3 a = textureLod(uSilk, m - flow * (p0 - 0.5), uSilkLod).rgb;
  vec3 b = textureLod(uSilk, m - flow * (p1 - 0.5), uSilkLod).rgb;
  vec3 c = mix(a, b, smoothstep(0.2, 0.8, abs(2.0 * p0 - 1.0)));
  vec2 inside = step(vec2(0.0), m) * step(m, vec2(1.0));
  return silkInk(c) * uSilkK * inside.x * inside.y;
}
void main() {
  float mk = uMaskOn > 0.5 ? frontMask(vUv) : 1.0;

  // The silk; the air wrapped around the glass is hidden wherever a sheet stands in front of the vial (uOcc, its
  // rectangle in screen uv).
  vec4 S = silkAt(vUv) * mk;
  if (uOccK > 0.0) {
    vec2 inO = step(uOcc.xy, vUv) * step(vUv, uOcc.zw);
    S *= 1.0 - inO.x * inO.y * uOccK;
  }

  // The mist.
  vec2 e = uDyeTexel * exp2(uLod) * 1.5;
  float v0 = veilAt(vUv) + bankAt(vUv) + puffAt(vUv);
  float d0 = dyeAt(vUv);
  float d = d0 + v0;
  float dl = dyeAt(vUv - vec2(e.x, 0.0)) + v0;
  float dr = dyeAt(vUv + vec2(e.x, 0.0)) + v0;
  float db = dyeAt(vUv - vec2(0.0, e.y)) + v0;
  float dt = dyeAt(vUv + vec2(0.0, e.y)) + v0;
  float clear = 1.0;
  if (uClear.w > 0.0) {
    vec2 cq = (vUv - uClear.xy) * vec2(uAspect, 1.0);
    clear = 1.0 - (1.0 - smoothstep(uClear.z * 0.55, uClear.z, length(cq))) * uClear.w;
  }
  vec3 n = normalize(vec3((dl - dr) * uBump, (db - dt) * uBump, 1.0));
  vec3 L = normalize(vec3(uLight, 0.9));
  float wrap = clamp(dot(n, L) * 0.6 + 0.4, 0.0, 1.0);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, H), 0.0), 24.0);
  float rim = clamp(length(n.xy) * 1.3, 0.0, 1.0);
  float ad = (1.0 - exp(-max(d0, 0.0) * uDensity)) * clear;
  float av = 1.0 - exp(-max(v0, 0.0) * uDensity);
  float a = 1.0 - (1.0 - ad) * (1.0 - av);
  vec3 col = mix(uShade, uLit, wrap);
  col += spec * 0.14;
  vec3 pearl = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + rim * 0.8 + d * 0.15 + 0.55));
  col = mix(col, col * (0.92 + 0.18 * pearl), 0.3 * rim);
  col = mix(col, uLit, (1.0 - smoothstep(0.0, 0.7, d)) * 0.4);
  vec4 M = vec4(col * a, a);

  vec4 C = M + (1.0 - M.a) * S;
  // The puff's smoke over everything, in front of the glass.
  vec4 P = puffSilk(vUv);
  C = P + (1.0 - P.a) * C;
  float g = (hash12(gl_FragCoord.xy + fract(uTime * 7.0) * 61.0) - 0.5) / 255.0;
  o = vec4(max(C.rgb + g * C.a, 0.0), C.a);
}`;class Co{constructor(t,o,a,i,s,f){E(this,"vel");E(this,"dye");E(this,"p");E(this,"disp");E(this,"div");E(this,"curl");E(this,"solid");E(this,"prog");E(this,"aspect");this.gl=t,this.full=o,this.aspect=a/i;const u=Math.min(a,i),l=Math.round(s*a/u),w=Math.round(s*i/u),T=Math.round(f*a/u),I=Math.round(f*i/u),U=t.HALF_FLOAT;this.vel=new ze(()=>ae(t,l,w,t.RG16F,t.RG,U)),this.p=new ze(()=>ae(t,l,w,t.R16F,t.RED,U)),this.disp=new ze(()=>ae(t,l,w,t.RG16F,t.RG,U)),this.div=ae(t,l,w,t.R16F,t.RED,U),this.curl=ae(t,l,w,t.R16F,t.RED,U),this.solid=ae(t,l,w,t.R8,t.RED,t.UNSIGNED_BYTE),this.dye=new ze(()=>ae(t,T,I,t.R16F,t.RED,U,!0)),this.prog={curl:new R(t,N,yo),forces:new R(t,N,wo),divergence:new R(t,N,To),pressure:new R(t,N,bo),gradient:new R(t,N,Eo),scale:new R(t,N,Ao),advect:new R(t,N,So),emit:new R(t,N,Po),splat:new R(t,N,go),disp:new R(t,N,ko)}}get dyeTex(){return this.dye.read.tex}get dispTex(){return this.disp.read.tex}get dyeSize(){return[this.dye.w,this.dye.h]}get velSize(){return[this.vel.w,this.vel.h]}into(t){const o=this.gl;o.bindFramebuffer(o.FRAMEBUFFER,t.fb),o.viewport(0,0,t.w,t.h)}splat(t){const{gl:o}=this;o.disable(o.BLEND);const a=this.prog.splat.use();a.tex("uSrc",0,this.vel.read.tex).f("uPoint",t.x,t.y).f("uValue",t.dx,t.dy,0,0).f("uRadius",t.radius).f("uAspect",this.aspect),this.into(this.vel.write),this.full(),this.vel.swap(),t.dye>0&&(a.tex("uSrc",0,this.dye.read.tex).f("uValue",t.dye,0,0,0).f("uRadius",t.radius*.6),this.into(this.dye.write),this.full(),this.dye.swap())}step(t){const{gl:o,prog:a}=this;o.disable(o.BLEND);const i=[1/this.vel.w,1/this.vel.h];a.curl.use().tex("uVel",0,this.vel.read.tex).f("uTexel",...i),this.into(this.curl),this.full(),a.forces.use().tex("uVel",0,this.vel.read.tex).tex("uCurl",1,this.curl.tex).tex("uSolid",2,this.solid.tex).f("uTexel",...i).f("uDt",t.dt).f("uConfine",t.confine).f("uRelax",Math.exp(-t.dt/Math.max(t.settle,.01))).f("uStir",t.stir).f("uTime",t.time).f("uDrift",...t.drift).f("uWidth",t.width).f("uSpeed",t.speed).f("uAspect",this.aspect).fv("uPath",t.path,2).i("uPathN",t.pathN),this.into(this.vel.write),this.full(),this.vel.swap(),a.divergence.use().tex("uVel",0,this.vel.read.tex).tex("uSolid",1,this.solid.tex).f("uTexel",...i),this.into(this.div),this.full(),a.scale.use().tex("uSrc",0,this.p.read.tex).f("uK",.8),this.into(this.p.write),this.full(),this.p.swap();const s=a.pressure.use().tex("uDiv",1,this.div.tex).tex("uSolid",2,this.solid.tex).f("uTexel",...i);for(let u=0;u<20;u++)s.tex("uP",0,this.p.read.tex),this.into(this.p.write),this.full(),this.p.swap();a.gradient.use().tex("uP",0,this.p.read.tex).tex("uVel",1,this.vel.read.tex).tex("uSolid",2,this.solid.tex).f("uTexel",...i),this.into(this.vel.write),this.full(),this.vel.swap();const f=a.advect.use().tex("uVel",0,this.vel.read.tex).tex("uSolid",2,this.solid.tex).f("uVelTexel",...i).f("uDt",t.dt).f("uWarp",.5,.5,t.warp).f("uShift",...t.shift);f.tex("uSrc",1,this.vel.read.tex).f("uKeep",t.velScale).f("uFloor",1),this.into(this.vel.write),this.full(),this.vel.swap(),a.disp.use().tex("uVel",0,this.vel.read.tex).tex("uDisp",1,this.disp.read.tex).f("uVelTexel",...i).f("uDt",t.dt).f("uKeep",Math.exp(-t.dt/Math.max(t.heal,.01))).f("uWarp",.5,.5,t.warp).f("uShift",...t.shift),this.into(this.disp.write),this.full(),this.disp.swap(),f.use().tex("uVel",0,this.vel.read.tex).tex("uSrc",1,this.dye.read.tex).f("uKeep",Math.exp(-t.dt/Math.max(t.fade,.01))).f("uFloor",.35),this.into(this.dye.write),this.full(),this.dye.swap(),a.emit.use().tex("uSrc",0,this.dye.read.tex).tex("uSolid",1,this.solid.tex).f("uWidth",t.width).f("uAmount",t.emit).f("uCeil",t.ceil).f("uTime",t.time).f("uDt",t.dt).f("uAspect",this.aspect).fv("uPath",t.path,2).i("uPathN",t.pathN),this.into(this.dye.write),this.full(),this.dye.swap(),o.bindTexture(o.TEXTURE_2D,this.dye.read.tex),o.generateMipmap(o.TEXTURE_2D)}free(){const t=this.gl;for(const o of[this.vel,this.dye,this.p,this.disp])Re(t,o.read),Re(t,o.write);Re(t,this.div),Re(t,this.curl),Re(t,this.solid);for(const o of Object.values(this.prog))t.deleteProgram(o.prog)}}const me=64,ee=16,zo=.45,it=640,Ue=260;class Bo{constructor(t,o,a){E(this,"pbo");E(this,"fence",null);E(this,"rowW",0);E(this,"data",new Uint8Array(0));E(this,"ctx");E(this,"cols",[new Float32Array(me*3),new Float32Array(me*3)]);E(this,"fresh",!0);E(this,"placed",[NaN,NaN]);this.gl=t,this.els=o,this.topWash=a,this.pbo=t.createBuffer(),this.ctx=o.map(i=>(i.width=Ue,i.height=Ue,i.getContext("2d",{alpha:!1})))}update(t,o,a){this.place(0,o-it/2),this.place(1,o+a+50-it/2);const i=this.gl;if(this.fence){const l=i.clientWaitSync(this.fence,0,0);if(l===i.TIMEOUT_EXPIRED)return;i.deleteSync(this.fence),this.fence=null,l!==i.WAIT_FAILED&&(i.bindBuffer(i.PIXEL_PACK_BUFFER,this.pbo),i.getBufferSubData(i.PIXEL_PACK_BUFFER,0,this.data),i.bindBuffer(i.PIXEL_PACK_BUFFER,null),this.paint(0,this.topWash),this.paint(1,null),this.fresh=!1)}const s=i.drawingBufferWidth,f=i.drawingBufferHeight,u=s*ee*4;s!==this.rowW&&(this.rowW=s,this.fresh=!0,this.data=new Uint8Array(u*2),i.bindBuffer(i.PIXEL_PACK_BUFFER,this.pbo),i.bufferData(i.PIXEL_PACK_BUFFER,u*2,i.STREAM_READ)),i.bindBuffer(i.PIXEL_PACK_BUFFER,this.pbo),i.readPixels(0,f-ee,s,ee,i.RGBA,i.UNSIGNED_BYTE,0),i.readPixels(0,Math.min(f-ee,Math.max(0,f-t)),s,ee,i.RGBA,i.UNSIGNED_BYTE,u),i.bindBuffer(i.PIXEL_PACK_BUFFER,null),this.fence=i.fenceSync(i.SYNC_GPU_COMMANDS_COMPLETE,0)}place(t,o){const a=Math.round(o);a!==this.placed[t]&&(this.placed[t]=a,this.els[t].style.transform=`translate3d(0, ${a}px, 0)`)}paint(t,o){const{data:a,rowW:i}=this,s=t*i*ee*4,f=this.ctx[t],u=this.cols[t],l=this.fresh?1:zo,w=f.createLinearGradient(0,0,Ue,0);for(let T=0;T<me;T++){const I=Math.floor(T*i/me),U=Math.max(I+1,Math.floor((T+1)*i/me));let q=0,P=0,m=0;for(let j=0;j<ee;j++)for(let Te=I,oe=s+(j*i+I)*4;Te<U;Te++,oe+=4)q+=a[oe],P+=a[oe+1],m+=a[oe+2];const W=(U-I)*ee;q=u[T*3]+=(q/W-u[T*3])*l,P=u[T*3+1]+=(P/W-u[T*3+1])*l,m=u[T*3+2]+=(m/W-u[T*3+2])*l,o&&(q+=(o[0]-q)*o[3],P+=(o[1]-P)*o[3],m+=(o[2]-m)*o[3]),w.addColorStop((T+.5)/me,`rgb(${q|0},${P|0},${m|0})`)}f.fillStyle=w,f.fillRect(0,0,Ue,Ue)}}const we=new URLSearchParams(location.search),tt=we.has("t")?Number(we.get("t")):null,Io=we.has("debug"),gt=we.get("only");var Bt;const Rt=((Bt=we.get("tour"))==null?void 0:Bt.split(":").map(Number))??null,Wo=we.get("patch")!=="0",qo=matchMedia("(prefers-reduced-motion: reduce)"),Oo={kind:"phone",url:"air/plate-phone.jpg",w:1024,h:1536,hero:{cx:511,base:946,width:284},ped:[157,926,865,1100],pedFlat:.052,back:[{file:"ghk-cu-100-mg",cx:175,base:816,width:84},{file:"bpc-157-10-mg",cx:861,base:816,width:84}],path:[[-160,1010],[150,880],[380,760],[640,600],[860,470],[1220,380]],silk:{url:"air/air-phone.jpg",x:-40,y:-130,w:1104,h:1656}},No={kind:"desk",url:"air/plate-desk.jpg",w:1536,h:1024,hero:{cx:766,base:704,width:250},ped:[457,686,1075,834],pedFlat:.053,back:[{file:"nad-plus-500-mg",cx:248,base:490,width:62},{file:"tesamorelin-10-mg",cx:1474,base:501,width:56},{file:"ghk-cu-100-mg",cx:104,base:539,width:62},{file:"bpc-157-10-mg",cx:1365,base:553,width:62}],path:[[-200,860],[300,700],[700,560],[1100,420],[1500,300],[1800,200]],silk:{url:"air/air-desk.jpg",x:-40,y:-60,w:1616,h:1077}},S={w:578,h:1112,glassL:23,glassW:532,foot:1109},Vo="air/vials/retatrutide-10-mg.png",ot={url:"air/vials/retatrutide-10-mg-label-3x.webp",y0:380,y1:890},Ut=4.5,te={cx:289,cy:632,w:540,h:470},Y={compound:{cx:466,cy:545,w:230,h:190},lot:{cx:98,cy:660,w:200,h:170},qr:{cx:270,cy:570,w:240,h:280}},Ko={compound:[380,466],lot:[22,662],qr:[184,572]},re={url:"air/coa-ret10.jpg",w:2049,h:2651},rt={whole:{x:0,y:0,w:re.w,h:re.h},lot:{x:770,y:318,w:300,h:180},purity:{x:234,y:624,w:526,h:260},content:{x:760,y:624,w:526,h:260},rt:{x:1286,y:624,w:528,h:260},trace:{x:234,y:1444,w:876,h:376}},se=["retatrutide-10-mg","bpc-157-10-mg","ghk-cu-100-mg","tesamorelin-10-mg","mots-c-10-mg","nad-plus-500-mg","semax-10-mg","melanotan-ii-10-mg"],Fe=15.45,De=.6,at=Fe+De*se.length,qt=e=>e.hero.width/S.glassW;function ye(e,t,o){const a=qt(e);return[e.hero.cx+(t-(S.glassL+S.glassW/2))*a,e.hero.base-(S.foot-o)*a]}const We=(e,t)=>Math.max(t.W/e.w,t.H/e.h);function qe(e,t,o){const a=Math.max(e.z,We(t,o)),i=e.ax*o.W/a,s=t.w-(1-e.ax)*o.W/a,f=e.ay*o.H/a,u=t.h-(1-e.ay)*o.H/a;return{...e,z:a,x:Math.min(Math.max(e.x,i),s),y:Math.min(Math.max(e.y,f),u)}}function Ot(e,t){const o=e.kind==="phone",a=We(e,t)*(o?1.2:1.08);return qe({x:e.hero.cx,y:e.hero.base,z:a,ax:o?.6:.58,ay:o?.64:.74},e,t)}function Ft(e,t,o,a){const i=qt(e);if(e.kind==="desk"){const[l,w]=ye(e,te.cx,te.cy);let T=Math.min(t.W*.5/(te.w*i),t.H*.64/(te.h*i));if(T=Math.min(T,Ut/(i*t.dpr)),a)return{x:l,y:w,z:T,ax:.7,ay:.5};const[I,U]=ye(e,o.cx,o.cy);return{x:l+(I-l)*.18,y:w+(U-w)*.18,z:T*1.08,ax:.7,ay:.5}}const[s,f]=ye(e,o.cx,o.cy);let u=Math.min(t.W*.96/(o.w*i),t.H*(a?.6:.45)/(o.h*i));return u=Math.min(u,Ut/(i*t.dpr)),{x:s,y:f,z:u,ax:.5,ay:a?.4:.36}}function Dt(e,t){if(e.kind==="phone"){const[a,i]=ye(e,190,600);return qe({x:a,y:i,z:We(e,t)*2,ax:1,ay:.5},e,t)}const[,o]=ye(e,te.cx,te.cy+60);return qe({x:e.hero.cx,y:o,z:We(e,t)*1.2,ax:.72,ay:.5},e,t)}function Xo(e,t,o){const a=Math.exp(Math.log(e.z)+(Math.log(t.z)-Math.log(e.z))*o),i=e.z===t.z?o:(1/e.z-1/a)/(1/e.z-1/t.z);return{x:e.x+(t.x-e.x)*i,y:e.y+(t.y-e.y)*i,z:a,ax:e.ax+(t.ax-e.ax)*o,ay:e.ay+(t.ay-e.ay)*o}}const g=e=>e<=0?0:e>=1?1:e<.5?4*e*e*e:1-Math.pow(-2*e+2,3)/2,Nt=e=>Math.min(1,Math.max(0,e)),b=(e,t,o)=>Nt((e-t)/(o-t));function Ho(e){const t=(s,f,u)=>({t:s,name:f,cam:u}),o=s=>Ot(e,s),a=s=>Ft(e,s,te,!0),i=s=>f=>Ft(e,f,s,!1);return[t(0,"arrive",o),t(.35,"arrive",o),t(1.9,"label",a),t(2.3,"label",a),t(3,"compound",i(Y.compound)),t(3.4,"compound",i(Y.compound)),t(4.1,"lot",i(Y.lot)),t(4.5,"lot",i(Y.lot)),t(5.2,"qr",i(Y.qr)),t(5.7,"qr",i(Y.qr)),t(6.5,"label",a),t(7.2,"aside",s=>Dt(e,s)),t(14,"aside",s=>Dt(e,s)),t(14.9,"plinth",o),t(at,"plinth",o)]}function _t(e,t,o){if(t<=e[0].t)return e[0].cam(o);for(let a=0;a<e.length-1;a++){const i=e[a],s=e[a+1];if(t<=s.t)return i.name===s.name?i.cam(o):Xo(i.cam(o),s.cam(o),g((t-i.t)/(s.t-i.t)))}return e[e.length-1].cam(o)}function $o(e,t,o){const a=e===rt.whole,i=1.5/t.dpr,[s,f,u,l]=o?a?[.82,.56,.5,.4]:[.9,.44,.5,.37]:a?[.42,.78,.7,.5]:[.46,.62,.7,.48],w=Math.min(t.W*s/e.w,t.H*f/e.h,i);return{x:e.x+e.w/2,y:e.y+e.h/2,z:w,ax:u,ay:l}}function Go(e){const t=(o,a)=>({t:o,name:a,cam:i=>$o(rt[a],i,e)});return[t(9.3,"whole"),t(10.15,"whole"),t(10.55,"lot"),t(10.9,"lot"),t(11.3,"purity"),t(11.65,"purity"),t(12,"content"),t(12.35,"content"),t(12.7,"rt"),t(13.05,"rt"),t(13.45,"trace"),t(13.85,"trace"),t(14.3,"whole")]}function Yo(e,t){for(let o=0;o<e.length-1;o++){const a=e[o],i=e[o+1];if(t>a.t&&t<i.t&&a.name!==i.name)return Math.sin(Math.PI*((t-a.t)/(i.t-a.t)))}return 0}const jo=e=>e<Fe+De?0:Math.min(se.length-1,Math.floor((e-Fe)/De)),Qo=.12;function Zo(e){for(let t=1;t<se.length;t++){const o=(e-(Fe+De*t))/Qo;if(Math.abs(o)<1)return{i:t,x:o,k:.5+.5*Math.cos(Math.PI*o)}}return{i:0,x:0,k:0}}function Jo(e,t){const o=a=>rt[a.name];if(t<=e[0].t)return o(e[0]);for(let a=0;a<e.length-1;a++){const i=e[a],s=e[a+1];if(t>s.t)continue;if(i.name===s.name)return o(i);const f=g((t-i.t)/(s.t-i.t)),u=o(i),l=o(s);return{x:u.x+(l.x-u.x)*f,y:u.y+(l.y-u.y)*f,w:u.w+(l.w-u.w)*f,h:u.h+(l.h-u.h)*f}}return o(e[e.length-1])}function Lt(e,t){for(let o=0;o<e.length-1;o++){const a=e[o],i=e[o+1];if(t>=a.t&&t<=i.t&&a.name!==i.name)return t-a.t<i.t-t?a.t:i.t}return t}const z=document.querySelector("#air"),B=document.documentElement;for(const e of document.querySelectorAll("[data-class]")){const t=Number(e.dataset.class),o=Fe+De*t,a=t===se.length-1?o+1.6:o+.45;e.dataset.beat=[o+.05,o+.15,a,a+.1].map(i=>i.toFixed(2)).join(" ")}const ei=Array.from(document.querySelectorAll("[data-beat]")),nt=document.querySelector(".leader"),Be=nt.querySelector("line"),kt=nt.querySelector(".leader-at"),Mt=nt.querySelector(".leader-from"),pe=Io?document.body.appendChild(Object.assign(document.createElement("pre"),{className:"air-debug"})):null;var It;(It=document.querySelector("[data-lookup]"))==null||It.addEventListener("submit",e=>{e.preventDefault();const t=String(new FormData(e.currentTarget).get("lot")??"").trim();location.href=t?`./#/verify?lot=${encodeURIComponent(t)}`:"./#/verify"});const Ct=()=>window.scrollY/Math.max(1,z.clientHeight);function ti(e){const t=Math.max(0,(e-7.3)/.3),o=Math.min(5,Math.floor(t));return o>=5?5:o+g(b(t-o,.4,1))}function zt(e,t){B.style.setProperty("--intro",t.toFixed(3)),B.style.setProperty("--trail",ti(e).toFixed(3));let o=null;for(const a of ei){const[i,s,f,u]=a.dataset.beat.split(" ").map(Number),l=e<s?b(e,i,s):1-b(e,f,u),w=l*(a.classList.contains("beat-hero")?t:1)>.001;a.style.setProperty("--k",l.toFixed(3)),a.style.visibility=w?"visible":"hidden",a.dataset.mark&&l>.001&&(!o||l>o.k)&&(o={el:a,k:l})}return o}async function oi(e,t){const[o,a,...i]=await Promise.all([ne(t.url),ne(t.silk.url),...t.back.map(s=>ne(`air/vials/${s.file}.webp`))]);return{plate:t,plateTex:ue(e,o,!1),silkTex:ue(e,a,!1),backTex:i.map(s=>ue(e,s,!0)),keys:Ho(t),sheet:Go(t.kind==="phone")}}async function ii(){const e=mo(z);if(!e){B.dataset.air="still",pe&&(pe.textContent=`no air: ${ai()}`);return}const t=po(e),o=(r,n)=>r/n>1.05?No:Oo,a=new Map,i=r=>(a.has(r)||a.set(r,oi(e,r)),a.get(r)),[s,f]=await Promise.all([ne(Vo),i(o(z.clientWidth,z.clientHeight))]),u=ue(e,s,!0);let l=f;const w=r=>r[r.length-1].t;B.style.setProperty("--story",String(Math.max(w(f.keys),w(f.sheet))+.3));let T=null;const I=se.map((r,n)=>n===0?u:null);let U=null;(Wo?ne(ot.url):Promise.reject(new Error("no patch"))).then(r=>{U=ue(e,r,!0)}).catch(()=>null).then(()=>ne(re.url)).then(r=>{T=ue(e,r,!1)}).finally(async()=>{for(let r=1;r<se.length;r++){const n=await ne(`air/vials/${se[r]}.webp`).catch(()=>null);n&&(I[r]=ue(e,n,!0))}});let q=null;const P={plate:new R(e,xe,Uo),cut:new R(e,xe,Fo),shadow:new R(e,xe,Do),solid:new R(e,xe,Ro),air:new R(e,N,Mo),paper:new R(e,xe,_o),sheetShadow:new R(e,xe,Lo)},m={W:0,H:0,dpr:1};let W=null,j=null;if(matchMedia("(pointer: coarse)").matches){const r=Array.from(document.querySelectorAll(".air-hem"));for(const n of r)n.style.height=`${it}px`;r.length===2&&(j=new Bo(e,[r[0],r[1]],[251,244,250,.55]))}const Te=document.querySelector(".air-flow"),oe=document.querySelector(".air-head");let ut=1/0,Ne=0;function st(){ut=Te?Te.offsetTop:1/0,Ne=oe?oe.getBoundingClientRect().bottom:0,m.dpr=Math.min(window.devicePixelRatio||1,2);const r=z.clientWidth,n=z.clientHeight;if(r===m.W&&n===m.H&&W)return;m.W=r,m.H=n,z.width=Math.round(r*m.dpr),z.height=Math.round(n*m.dpr),W==null||W.free();const h=Math.min(r,n)<600;W=new Co(e,t.full,r,n,h?112:128,h?400:512);const d=o(r,n);d!==l.plate&&q!==d&&(q=d,i(d).then(F=>{q===F.plate&&(l=F,q=null,Ee=null)}))}st(),new ResizeObserver(st).observe(z);function Q(r,n,h,d){const{W:F,H:D}=m;return[r/F*2-1,1-(n+d)/D*2,(r+h)/F*2-1,1-n/D*2]}function ce(r,n,h){return[r.ax*m.W+(n-r.x)*r.z,r.ay*m.H+(h-r.y)*r.z]}function ct(r,n){const h=n.width/S.glassW*r.z,[d,F]=ce(r,n.cx,n.base);return{left:d-(S.glassL+S.glassW/2)*h,top:F-S.foot*h,w:S.w*h,h:S.h*h,s:h}}const lt=[];let Z=null;function Ve(r,n,h){const d=performance.now();if(h==="start"||!Z){Z={x:r,y:n,t:d};return}const F=Math.max(8,d-Z.t)/1e3,D=(r-Z.x)/F,k=(n-Z.y)/F;if(Z={x:r,y:n,t:d},!W)return;const O=W.velSize[0]/m.W,le=.55;lt.push({x:r/m.W,y:1-n/m.H,dx:Math.max(-900,Math.min(900,D*O*le)),dy:Math.max(-900,Math.min(900,-k*O*le)),radius:m.W<600?.0028:.0016,dye:0})}window.addEventListener("pointermove",r=>{r.pointerType==="mouse"&&Ve(r.clientX,r.clientY,Z?"move":"start")},{passive:!0}),window.addEventListener("touchstart",r=>{const n=r.touches[0];n&&Ve(n.clientX,n.clientY,"start")},{passive:!0}),window.addEventListener("touchmove",r=>{const n=r.touches[0];n&&Ve(n.clientX,n.clientY,"move")},{passive:!0}),window.addEventListener("touchend",()=>{Z=null},{passive:!0});let p=tt??Ct(),ft=p,be=0,Ee=null,ht=null,Ke=!1,Ae=0,_e=performance.now();const Xe=new Float32Array(Ie*2);let He=0,$e=_e,Ge=0,Ye=0;const dt=36;let vt=_e;const Vt=[.985,.957,.98],Kt=[.77,.69,.87];function je(r){const{W:n,H:h}=m,{plate:d,keys:F}=l,D=Ye<dt,k=qo.matches,O=D?1/60:Math.min(1/30,Math.max(1/240,(r-_e)/1e3));_e=r,D&&(Ye++,vt=r,Ye===dt&&(B.dataset.air="on")),(!k||D)&&(Ae+=O);const le=(r-vt)/1e3,Qe=k||tt!==null,Se=tt??Ct(),Xt=Math.abs(Se-ft)>1.5;ft=Se,k?(p=Lt(F,Se),be=0):Xt?(p=Se,be=0,Ee=null):(be+=(81*(Se-p)-18*be)*O,p+=be*O);const Ze=ut-window.scrollY;if(Ze<Ne!=(B.dataset.flow==="on")&&(Ze<Ne?B.dataset.flow="on":delete B.dataset.flow),Ze<=0&&!D){Ke||zt(p,1),Ke=!0,Ee=null,requestAnimationFrame(je);return}Ke=!1;const Le=zt(p,Qe?1:D?0:g(b(le,.9,2.3))),y=qe(_t(F,p,m),d,m);y.z*=1+.05*(1-(Qe?1:g(b(le,0,3.2))));const V=W,K=Ee??y,Ht=K.z/y.z,[$t,Gt]=[y.x+(.5-y.ax)*n/y.z,y.y+(.5-y.ay)*h/y.z],[Yt,jt]=[K.x+(.5-K.ax)*n/K.z,K.y+(.5-K.ay)*h/K.z],Qt=[($t-Yt)*K.z/n,-(Gt-jt)*K.z/h];Ee=y;const v=ct(y,d.hero),fe=T?g(b(p,9.2,9.95))*(1-g(b(p,13.95,14.6))):0;e.bindFramebuffer(e.FRAMEBUFFER,V.solid.fb),e.viewport(0,0,V.solid.w,V.solid.h),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.disable(e.BLEND);{const A=v.left+v.w*.16000000000000003/2,_=v.top+v.h*(1-.97);P.solid.use().tex("uTex",0,u.tex).f("uRect",...Q(A,_,v.w*.84,v.h*.97)),t.quad()}d.path.forEach(([c,x],A)=>{const[_,M]=ce(y,c,x);Xe[A*2]=_/n,Xe[A*2+1]=1-M/h});const he=b(Math.log(y.z/Ot(d,m).z),0,Math.log(3));for(const c of lt.splice(0))V.splat(c);const Zt=D?6:k?0:1;for(let c=0;c<Zt;c++)V.step({dt:O,time:Ae+c*O,path:Xe,pathN:d.path.length,width:.11*(1+he*1.4),speed:0,drift:[0,0],settle:1.4,stir:0,confine:4,emit:0,ceil:1.6,fade:7,warp:c===0?Ht:1,shift:c===0?Qt:[0,0],velScale:c===0?Math.min(1.08,Math.max(.92,y.z/K.z)):1,heal:2.2});e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,z.width,z.height),e.disable(e.BLEND);const[Jt,eo]=ce(y,0,0);gt==="air"?(e.clearColor(.16,.12,.26,1),e.clear(e.COLOR_BUFFER_BIT)):(P.plate.use().tex("uTex",0,l.plateTex.tex).f("uRect",...Q(Jt,eo,d.w*y.z,d.h*y.z)).f("uSize",d.w,d.h).f("uFar",1.5+he*2.8+fe*2).f("uNear",1.8+he*2+fe*2).f("uPed",...d.ped).f("uExposure",.95).f("uTint",.56,.5,.69).f("uTintK",.32),t.quad()),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA);const X=d.kind==="phone",xt=g(b(p,1.15,1.65))*(1-g(b(p,at+.3,at+.8))),de=g(b(p,6.3,7.1))*(X?1-g(b(p,9.05,9.55)):1),to=de*xt;d.back.forEach((c,x)=>{const A=ct(y,c);P.cut.use().tex("uTex",0,l.backTex[x].tex).tex("uPatch",1,u.tex).f("uPatchK",0).f("uRect",...Q(A.left,A.top,A.w,A.h)).f("uLod",1.6+he*2.5+fe*1.5).f("uAlpha",.92*(1-.65*to)*(1-g(b(p,14.2,14.8)))).f("uPool",.5,.5,10,10).f("uPoolK",0),t.quad()});const[oo,io]=V.dyeSize,mt=Qe?3:Math.max(-.4,-.4+g(b(le,.25,3.4))*3.2),ao=X?.33+(1.02-.33)*de:.42+(1.02-.42)*de,ro=X?2+(.66-2)*de:.46+(.5-.46)*de,Pe=[(v.left+v.w/2)/n,1-(v.top+v.h*.55)/h],[pt,yt]=ce(y,d.silk.x,d.silk.y),no=d.silk.w*y.z,uo=d.silk.h*y.z,wt=.8,so=[(v.left+v.w*(1-wt)/2)/n,1-(v.top+v.h)/h,(v.left+v.w*(1+wt)/2)/n,1-(v.top+v.h*(1-.95))/h],J=Zo(p),Tt=[0,0,0,0];let bt=0;const Et=c=>{P.air.use().tex("uDye",0,V.dyeTex).tex("uMask",1,u.tex).tex("uSilk",2,l.silkTex.tex).tex("uDisp",3,V.dispTex).f("uSilkRect",pt/n,1-(yt+uo)/h,(pt+no)/n,1-yt/h).f("uSilkK",c?.75*(1-fe):1).f("uSilkLod",(c?1.4:0)+he*(c?2.2:1.8)).f("uFlow",.014,-.006).f("uCycle",Ae/5%1).f("uDispK",1).f("uMaskInner",...so).f("uDyeTexel",1/oo,1/io).f("uLod",c?1.2:.4).f("uDensity",1.15).f("uBump",3.2).f("uLight",-.55,.62).f("uLit",...Vt).f("uShade",...Kt).f("uTime",Ae).f("uAspect",n/h).f("uMaskRect",v.left/n,1-(v.top+v.h)/h,(v.left+v.w)/n,1-v.top/h).f("uMaskOn",c?1:0).f("uDyeK",c?.85:1).f("uClear",Pe[0],1-(v.top+v.h*(te.cy/S.h))/h,.5*v.w/h,c?he:0).f("uVeil",mt).f("uVeilK",c&&mt<2.9?2.4:0).f("uVeilC",Pe[0],Pe[1]).f("uBank",c?(X?1.7:1.5)*(1+.5*de)*xt:0,ao).f("uBankX",ro).f("uOcc",...Tt).f("uOccK",c?bt:0).f("uPuff",Pe[0],Pe[1],v.h/h*.5,c&&!k?J.k:0).f("uPuffFlow",J.x,J.i),t.full()};Et(!1);{const c=v.s*S.glassW,[x,A]=ce(y,d.hero.cx,d.hero.base),_=d.pedFlat;P.shadow.use().f("uColor",.16,.1,.3),P.shadow.f("uRect",...Q(x+c*.18-c*.75,A-c*_*1.6,c*1.5,c*_*2.2)).f("uAlpha",.3),t.quad(),P.shadow.f("uRect",...Q(x-c*.46,A-c*_*.9,c*.92,c*_*1.25)).f("uAlpha",.55),t.quad()}const co=b(p,2.4,2.9)*(1-b(p,5.9,6.4)),ke=p<3.7?Y.compound:p<4.8?Y.lot:Y.qr,Je=c=>{for(let x=c;x>=0;x--)if(I[x])return I[x];return u},At=J.k>0?g(b(J.x,-.35,.35)):0,lo=J.k>0?[[Je(J.i-1),1-At],[Je(J.i),At]]:[[Je(jo(p)),1]];for(const[c,x]of lo)x<=.001||(P.cut.use().tex("uTex",0,c.tex).tex("uPatch",1,(U??u).tex).f("uPatchY",ot.y0/S.h,ot.y1/S.h).f("uPatchK",U&&c===u?1:0).f("uPatchLod",Math.max(0,Math.log2(3/(v.s*m.dpr)))).f("uRect",...Q(v.left,v.top,v.w,v.h)).f("uLod",fe*2.5).f("uAlpha",x).f("uPool",ke.cx/S.w,ke.cy/S.h,ke.w*.62/S.w,ke.w*.5/S.h).f("uPoolK",.16*co),t.quad());if(fe>.001&&T){const c=k?Lt(l.sheet,p):p,x=_t(l.sheet,c,m),A=Jo(l.sheet,c),_=b(p,9.25,10),M=re.w*x.z,C=re.h*x.z,H=x.ax*n-x.x*x.z,ge=x.ay*h-x.y*x.z,fo=X?.84*h:h+12,et=b(p,14,14.6),ho=k?0:(Math.pow(1-_,3)+et*et)*Math.max(0,fo-ge),ie=ge+ho,Me=k?0:8*(1-b(_,.35,.9))+2.5*Yo(l.sheet,c)+8*b(et,.2,.8),Ce=k?g(b(p,9.35,9.55))*(1-g(b(p,14.1,14.3))):1,L=m.dpr,St=z.height,G=.05*M+16+Me;P.sheetShadow.use().f("uRect",...Q(H-G,ie-G+.012*C+4,M+2*G,C+2*G)).f("uSize",M+2*G,C+2*G).f("uBox",M/2-.3*G,C/2-.3*G,G).f("uAlpha",.2*Ce).f("uColor",.16,.1,.3),t.quad();const ve=Me*1.2;ht={sl:H,stp:ie,sw:M,sh:C,shownK:Ce,defocus:Me,z:x.z},Tt.splice(0,4,H/n,1-(ie+C)/h,(H+M)/n,1-ie/h),bt=Ce,P.paper.use().tex("uTex",0,T.tex).f("uRect",...Q(H-ve,ie-ve,M+2*ve,C+2*ve)).f("uPad",ve/M,ve/C).f("uDefocus",Me*L).f("uTime",Ae).f("uTexSize",re.w,re.h).f("uScale",x.z*L).f("uFocus",(H+A.x*x.z)*L,St-(ie+(A.y+A.h)*x.z)*L,(H+(A.x+A.w)*x.z)*L,St-(ie+A.y*x.z)*L).f("uFall",(X?.35*n:.18*n)*L,(X?.16:.2)*h*L).f("uBlur",9*L).f("uFog",...X?[0,1,.18*h*L,.36*h*L]:[1,0,.28*n*L,.47*n*L]).f("uFogWander",(X?.04*h:.035*n)*L).f("uAlpha",Ce).f("uTint",.93,.9,1).f("uTintK",.5),t.quad()}if(gt!=="room"&&Et(!0),!X&&Le){const c=Le.el.dataset.mark,[x,A]=ye(d,...Ko[c]),[_,M]=ce(y,x,A),C=Le.el.querySelector(".v").getBoundingClientRect(),H=C.left+Math.min(C.width,360)+28,ge=C.top+C.height*.55;Be.setAttribute("x1",H.toFixed(1)),Be.setAttribute("y1",ge.toFixed(1)),Be.setAttribute("x2",(_-6).toFixed(1)),Be.setAttribute("y2",M.toFixed(1)),kt.setAttribute("cx",_.toFixed(1)),kt.setAttribute("cy",M.toFixed(1)),Mt.setAttribute("cx",H.toFixed(1)),Mt.setAttribute("cy",ge.toFixed(1)),B.style.setProperty("--leader",g(Le.k).toFixed(3)),B.dataset.leader="on"}else B.dataset.leader&&delete B.dataset.leader;j==null||j.update(Math.round(window.innerHeight*m.dpr),window.scrollY,window.innerHeight),He++,r-$e>500&&(Ge=He*1e3/(r-$e),He=0,$e=r),pe&&(pe.textContent=`t ${p.toFixed(2)}  z ${y.z.toFixed(3)}  fps ${Ge.toFixed(0)}  ${d.kind}
${n}×${h} @${m.dpr}  vel ${V.velSize.join("×")}  dye ${V.dyeSize.join("×")}`),window.__air={t:p,z:y.z,fps:Ge,W:n,H:h,plate:d.kind,sheet:ht},requestAnimationFrame(je)}if(requestAnimationFrame(je),Rt){const[r,n,h]=Rt,d=()=>z.clientHeight;window.scrollTo(0,r*d());const F=performance.now()+3e3,D=k=>{const O=Nt((k-F)/(h*1e3));window.scrollTo(0,(r+(n-r)*O)*d()),O<1&&requestAnimationFrame(D)};requestAnimationFrame(D)}}function ai(){const e=document.createElement("canvas").getContext("webgl2");return e?`webgl2 ext: ${["EXT_color_buffer_float","EXT_color_buffer_half_float","OES_texture_float_linear"].filter(o=>e.getExtension(o)).join(", ")||"none"}`:"no webgl2"}ii().catch(e=>{console.error(e),B.dataset.air="still",pe&&(pe.textContent=`air failed: ${String((e==null?void 0:e.message)??e).slice(0,600)}`)});
