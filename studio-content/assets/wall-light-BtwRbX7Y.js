const E="attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }",_=`precision highp float;
uniform vec2 res;
uniform float px;
uniform float t;
uniform float scroll;
uniform float wallTop;
uniform float strength;

float box(vec2 p, vec2 lo, vec2 hi, float soft) {
  vec2 a = smoothstep(lo - soft, lo + soft, p);
  vec2 b = 1.0 - smoothstep(hi - soft, hi + soft, p);
  return a.x * a.y * b.x * b.y;
}

// Four panes and their mullions in a unit window.
float panes(vec2 q, float soft) {
  float m = 0.045;
  return box(q, vec2(0.0), vec2(0.5 - m), soft)
    + box(q, vec2(0.5 + m, 0.0), vec2(1.0, 0.5 - m), soft)
    + box(q, vec2(0.0, 0.5 + m), vec2(0.5 - m, 1.0), soft)
    + box(q, vec2(0.5 + m), vec2(1.0), soft);
}

// Light through moving water and glass (after joltz0r's tileable water caustic).
float caustic(vec2 p, float time) {
  vec2 i = p;
  float c = 1.0;
  const float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = time * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 6.0);
}

// One window's light on the wall: its panes, brightest nearest the window and fading along their fall, and a broad
// faint glow around them. The windows fall one to each stretch of the wall, alternately nearer its left and its right
// side, leaning down to the right as the photograph's light does, a little moved by the day.
float windowAt(vec2 wall, float k, float w, float unit, float period, float day) {
  float side = mod(k, 2.0);
  vec2 size = vec2(0.42, 0.8) * unit;
  float lean = 0.35;
  float leftX = 0.03 * w;
  float rightX = w - 0.03 * w - size.x - lean * size.y;
  vec2 origin = vec2(mix(leftX, rightX, side) + sin(day + k) * 0.03 * unit, (k + 0.12) * period + cos(day * 0.8 + k) * 0.02 * unit);
  vec2 local = wall - origin;
  local.x -= lean * local.y;
  vec2 q = local / size;
  float light = panes(q, 0.04) * mix(1.0, 0.45, clamp(q.y, 0.0, 1.0));
  float glow = box(q, vec2(-0.3, -0.15), vec2(1.3, 1.2), 0.35) * 0.18;
  return light + glow;
}

void main() {
  // This pixel on the screen, in CSS pixels from the top left, and the screen's size.
  vec2 css = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) * px;
  float w = res.x * px;
  float h = res.y * px;
  // A window's light is sized as a window is, not as the screen is: to the screen's width up to a laptop's.
  float unit = min(w, 900.0);
  // Where it lies on the wall: across, and down from the wall's top. The wall's top is the opening's foot; the light
  // on the wall moves at half the page's pace (at the moment the wall's top reaches the screen's top, the two
  // coincide).
  vec2 wall = vec2(css.x, css.y + 0.5 * (scroll - wallTop));
  // The wall begins at the opening's foot (on screen, wallTop - scroll), the light coming up out of its mist.
  float onWall = smoothstep(0.0, 0.6, (css.y - (wallTop - scroll)) / unit);

  // About one window to each screen of the wall. Each stretch draws its neighbours' light too, so no window's glow is
  // ever cut where one stretch meets the next.
  float day = t * 0.012;
  float period = 1.15 * h;
  float k = floor(wall.y / period);
  float light = windowAt(wall, k - 1.0, w, unit, period, day) + windowAt(wall, k, w, unit, period, day) + windowAt(wall, k + 1.0, w, unit, period, day);

  // Clouds: the light dims and returns, slowly.
  float cloud = 0.8 + 0.2 * sin(t * 0.11 + sin(t * 0.037) * 2.0);

  // The ripple of the glass in the light, its edges just split into colour.
  vec2 cp = wall / unit * 1.7 + vec2(t * 0.01, -t * 0.006);
  cp = mod(cp * 6.28318, 6.28318) - 250.0;
  float time = t * 0.3 + 23.0;
  float spread = 0.05;
  vec3 ripple = vec3(caustic(cp + vec2(spread, 0.0), time), caustic(cp, time), caustic(cp - vec2(spread, 0.0), time));

  // The panes' light first, the ripples within it carrying most of it: the window reads, and the water moving in it
  // is seen, as light on a pool's floor is.
  float lit = light * cloud * onWall * strength;
  vec3 colour = mix(vec3(0.97, 0.955, 1.0), vec3(1.0), clamp(ripple, 0.0, 1.0));
  float a = clamp(lit * (0.44 + 1.0 * clamp(ripple.g, 0.0, 1.3)), 0.0, 0.93);
  gl_FragColor = vec4(colour * a, a);
}`;function q(o,m,h){const t=o.getContext("webgl",{premultipliedAlpha:!0,alpha:!0,antialias:!1,depth:!1,stencil:!1,powerPreference:"low-power"});if(!t)return null;const p=(e,r)=>{const n=t.createShader(e);return n?(t.shaderSource(n,r),t.compileShader(n),t.getShaderParameter(n,t.COMPILE_STATUS)?n:null):null},d=p(t.VERTEX_SHADER,E),w=p(t.FRAGMENT_SHADER,_),i=t.createProgram();if(!d||!w||!i||(t.attachShader(i,d),t.attachShader(i,w),t.linkProgram(i),!t.getProgramParameter(i,t.LINK_STATUS)))return null;t.useProgram(i);const g=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,g),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),t.STATIC_DRAW);const u=t.getAttribLocation(i,"p");t.enableVertexAttribArray(u),t.vertexAttribPointer(u,2,t.FLOAT,!1,0,0);const a=e=>t.getUniformLocation(i,e),v=a("res"),x=a("px"),A=a("t"),y=a("scroll"),b=a("wallTop"),T=a("strength");t.uniform1f(T,1);let l=0,s=!1,c=!1;const F=performance.now(),R=()=>{const e=Math.max(1,Math.round(o.clientWidth/2)),r=Math.max(1,Math.round(o.clientHeight/2));(o.width!==e||o.height!==r)&&(o.width=e,o.height=r,t.viewport(0,0,e,r)),t.uniform2f(v,e,r),t.uniform1f(x,o.clientWidth/e)},S=e=>{R(),t.uniform1f(A,h?40:(e-F)/1e3),t.uniform1f(y,window.scrollY),t.uniform1f(b,m()),t.drawArrays(t.TRIANGLES,0,3)},f=e=>{l=0,!(!s||c||document.hidden)&&(S(e),h||(l=requestAnimationFrame(f)))};return{setActive(e){e!==s&&(s=e,e&&!l&&(l=requestAnimationFrame(f)))},redraw(){s&&!c&&!l&&(l=requestAnimationFrame(f))},stop(){c=!0,cancelAnimationFrame(l),t.clear(t.COLOR_BUFFER_BIT)}}}export{q as s};
