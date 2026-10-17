import"./events-COrBOttW.js";import{s as br}from"./store-B16AxyFS.js";import{a as Tr,p as Mt}from"./catalog-DOeYXmzq.js";import{l as Rr,e as Lr,L as At,r as Sr,d as Mr,b as Ft,s as Ct}from"./certificate-records-sOxRHAva.js";import{p as Ar,a as Fr}from"./store--uL3znJ3.js";import{p as Cr}from"./data-Cgh5ypzl.js";import{r as S,j as m}from"./client-CNJUigLn.js";import{r as Nr,F as zr,L as Kt}from"./app-BHcGIlxX.js";import{a as Zt,b as Nt}from"./motion-BhBHD7oz.js";import{A as Pr}from"./arrow-right-BLHg87fR.js";import{A as Dr}from"./arrow-up-right-BCnIhTfm.js";import{C as Ur}from"./check-CjYH997y.js";import{a as Ie}from"./assetUrl-5csJ5rj6.js";const zt=e=>e.replace(/\s/g,"").toLocaleLowerCase();function _r(e,t=""){const o=zt(t);return e.filter(r=>{var i;return r.status==="released"&&!r.sample&&(!o||[r.lot,((i=Tr(r.productId))==null?void 0:i.name)??""].some(a=>zt(a).includes(o)))}).sort((r,i)=>(i.releasedAt??"").localeCompare(r.releasedAt??"")||r.lot.localeCompare(i.lot))}function Jo(e){return Rr(e.results)}const en={library:()=>br.lots.list().then(e=>_r(e)),articles:{list:(e=!1)=>Promise.resolve(Fr(e)),get:e=>Promise.resolve(Ar().find(t=>t.slug===e)??null)}};function tn(e){return e.trim().toUpperCase().replace(/\s+/g,"").replace(/[–—]/g,"-")}function rn(e){const t=Cr.find(i=>i.id===e.productId);if(!t||e.sample)return null;const o=e.status==="released"?"released":e.status==="archived"?"archived":e.status==="rejected"?"withheld":"pending",r=o==="released"||o==="archived";return{lot:e.lot,product:t,status:o,results:r?e.results:[],reference:r?e.reference:void 0,testedAt:r?e.testedAt:void 0,releasedAt:r?e.releasedAt:void 0,coaUrl:r?e.coaUrl:void 0,sample:e.sample}}const jr=420,Ir='a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex="0"]',kr="(max-width: 760px)";function on(){const e=()=>{const r=window.visualViewport;return r?{top:r.offsetTop,height:r.height,page:r.pageTop}:null},[t,o]=S.useState(e);return S.useLayoutEffect(()=>{const r=window.visualViewport;if(!r)return;const i=()=>o(e());return i(),r.addEventListener("resize",i),r.addEventListener("scroll",i),window.addEventListener("scroll",i,{passive:!0}),()=>{r.removeEventListener("resize",i),r.removeEventListener("scroll",i),window.removeEventListener("scroll",i)}},[]),t}const nn=(e,t)=>e?{[`--${t}-top`]:`${e.top}px`,[`--${t}-height`]:`${e.height}px`}:void 0;function sn(){S.useLayoutEffect(()=>{const e=document.documentElement,t=document.body,o=window.scrollY,r=window.location.href,i=window.innerWidth-e.clientWidth,a={overflow:e.style.overflow,padding:t.style.paddingRight};e.style.overflow="hidden",e.dataset.scrollLocked="",i>0&&(t.style.paddingRight=`${i}px`);const h=()=>{Math.abs(window.scrollY-o)>1&&window.scrollTo({top:o,behavior:"instant"})},s=window.visualViewport,u=(s==null?void 0:s.height)??0,f=()=>{s&&s.height>=u-1&&h()};return s==null||s.addEventListener("resize",f),()=>{s==null||s.removeEventListener("resize",f),e.style.overflow=a.overflow,delete e.dataset.scrollLocked,t.style.paddingRight=a.padding,window.location.href===r&&h()}},[])}function Br(e){const t=Zt(),o=zr(),[r,i]=S.useState(t?"open":"entering"),a=S.useRef(e);a.current=e;const h=S.useRef(!1),s=S.useRef(0);S.useLayoutEffect(()=>{if(r!=="entering")return;let y=0;const T=requestAnimationFrame(()=>{y=requestAnimationFrame(()=>i(L=>L==="entering"?"open":L))});return()=>{cancelAnimationFrame(T),cancelAnimationFrame(y)}},[]);const u=S.useCallback(()=>{if(!h.current){if(h.current=!0,t){a.current();return}i("leaving"),s.current=window.setTimeout(()=>a.current(),jr)}},[t]),f=S.useCallback(()=>{h.current&&(h.current=!1,window.clearTimeout(s.current),i("open"))},[]);return{state:o&&r==="leaving"?"open":r,requestClose:u,reopen:f}}function an(e,t){const{state:o,requestClose:r,reopen:i}=Br(t);return S.useLayoutEffect(()=>{e?i():r()},[e,i,r]),o}function un(e,t,o,r=!1){const i=S.useRef(t);i.current=t;const a=S.useRef(r);a.current=r;const h=S.useRef(null),s=S.useRef(!1),u=S.useRef(0),f=()=>{var p;const T=e.current,L=((p=window.matchMedia)==null?void 0:p.call(window,"(pointer: fine)").matches)??!0,w=T==null?void 0:T.querySelector("input:not([type=hidden]), textarea");return w&&(o==="always"||o==="fine"&&L)?w:T},y=()=>{var L,w,p;s.current=!0;const T=document.activeElement;(!T||T===document.body||(L=e.current)!=null&&L.contains(T))&&((p=(w=h.current)==null?void 0:w.focus)==null||p.call(w,{preventScroll:!0}))};S.useLayoutEffect(()=>{var w;h.current=document.activeElement;const T=e.current;if(!T)return;o==="always"&&((w=f())==null||w.focus({preventScroll:!0})),u.current=window.setTimeout(()=>{var p;return(p=f())==null?void 0:p.focus({preventScroll:!0})},60);function L(p){if(a.current)return;if(p.key==="Escape"){p.preventDefault(),i.current();return}if(p.key!=="Tab"||!T)return;const E=Array.from(T.querySelectorAll(Ir)).filter(R=>R.getClientRects().length),n=E[0],d=E[E.length-1];!n||!d||(p.shiftKey&&(document.activeElement===n||document.activeElement===T)?(p.preventDefault(),d.focus()):!p.shiftKey&&document.activeElement===d&&(p.preventDefault(),n.focus()))}return document.addEventListener("keydown",L),()=>{window.clearTimeout(u.current),document.removeEventListener("keydown",L),s.current||y()}},[]),S.useLayoutEffect(()=>{var T;if(r!==s.current){if(r){window.clearTimeout(u.current),y();return}s.current=!1,(T=f())==null||T.focus({preventScroll:!0})}},[r])}function cn(e,t,o=()=>!0){const r=S.useRef(null),i=s=>{var f;const u=s.target;s.pointerType==="mouse"||u.closest("button, a, input, select, textarea")||!o(u)||!((f=window.matchMedia)!=null&&f.call(window,kr).matches)||!e.current||(r.current={start:s.clientY,at:performance.now(),distance:0,id:s.pointerId},s.currentTarget.setPointerCapture(s.pointerId),e.current.style.transition="none")},a=s=>{const u=r.current;!u||s.pointerId!==u.id||!e.current||(u.distance=Math.max(0,s.clientY-u.start),e.current.style.transform=`translateY(${u.distance}px)`)},h=s=>{const u=r.current;if(!u||s.pointerId!==u.id||!e.current)return;r.current=null;const f=u.distance/Math.max(1,performance.now()-u.at);e.current.style.transition="",e.current.style.transform="",(u.distance>120||u.distance>40&&f>.5)&&t()};return{onPointerDown:i,onPointerMove:a,onPointerUp:h,onPointerCancel:h}}function ln({seen:e,state:t,layer:o}){return e?Nr.createPortal(m.jsx("div",{className:"tm-sheet-skirt","data-state":t,"aria-hidden":"true",style:{top:e.page+e.height,zIndex:o-1}}),document.body):null}function Pt(e){if(!e)return;const t=new Date(e);if(Number.isNaN(t.getTime()))return;const o=r=>new Intl.DateTimeFormat("en-US",{...r,timeZone:"UTC"}).format(t);return`${o({day:"2-digit"})} ${o({month:"short"})} ${o({year:"numeric"})}`}const $r=e=>["HPLC","Mass spectrometry","LAL"].includes(e)||/^HPLC \(.+\)$/.test(e);function We(e,t){if(t==="HPLC")return`${e} (HPLC)`;if(t==="Mass spectrometry")return`${e} (MS)`;if(t==="LAL")return`${e} (LAL)`;const o=t.match(/^HPLC \((.+)\)$/);return o?`${e} (HPLC: ${o[1]})`:e}function Dt(e,t){return t==="%"?`${e}%`:t?`${e} ${t}`:e}const Or={released:"Approved",archived:"Archived",withheld:"Not released",pending:"Pending"};function ue({label:e,children:t,style:o,className:r}){return m.jsxs("div",{className:r,style:o,children:[m.jsx("dt",{children:e}),m.jsx("dd",{children:t})]})}function Ut(){return m.jsxs(m.Fragment,{children:[m.jsx(Ur,{size:14,strokeWidth:2,"aria-hidden":"true"}),m.jsx("span",{className:"sr-only",children:", meets specification"})]})}function fn({record:e,reveal:t=!1,className:o=""}){const r=e.status==="released"||e.status==="archived",i=Pt(e.testedAt),a=Pt(e.releasedAt),h=r?Lr(e.reference):void 0;let s=0;const u=()=>({"--tm-i":s++});return m.jsx("div",{className:o,children:m.jsxs("article",{className:`tm-coa is-${e.status}`,"data-reveal":t?"":void 0,"aria-label":`Certificate of analysis, lot ${e.lot}`,children:[m.jsxs("header",{className:"tm-coa-head",children:[m.jsx("span",{className:"tm-coa-title",children:"Certificate of Analysis"}),m.jsxs("span",{className:"tm-coa-status",children:[m.jsx("i",{"aria-hidden":"true"}),Or[e.status]]})]}),m.jsxs("dl",{className:"tm-coa-rows",children:[m.jsx(ue,{label:"Lot",children:m.jsx("span",{className:"tm-mono",children:e.lot})}),m.jsxs(ue,{label:"Compound",children:[e.product.name," · ",e.product.size]}),m.jsx(ue,{label:"Testing laboratory",children:r?At.name:"Contracted laboratory"})]}),r&&Sr(e.results).map(f=>m.jsxs(S.Fragment,{children:[f.component&&m.jsx("p",{className:"tm-coa-component",children:f.component}),m.jsxs("dl",{className:"tm-coa-rows",children:[f.purity&&m.jsxs(ue,{label:We("Purity",f.purity.method),className:"is-result",style:u(),children:[Dt(f.purity.value,f.purity.unit),m.jsx(Ut,{})]}),f.identity&&m.jsxs(ue,{label:We("Identity",f.identity.method),className:"is-result",style:u(),children:[f.identity.value,m.jsx(Ut,{})]}),f.content&&m.jsxs(ue,{label:We(f.content.unit==="mg per vial"?"Content per vial":Ct(f.content.label).base,f.content.method),className:"is-result is-detailed",style:u(),children:[m.jsx("span",{children:Mr(f.content)}),Ft(f)&&m.jsx("small",{children:Ft(f)})]}),f.other.map(y=>m.jsxs(ue,{label:We(Ct(y.label).base,y.method),className:"is-result is-detailed",style:u(),children:[m.jsx("span",{children:Dt(y.value,y.unit)}),y.method&&!$r(y.method)&&m.jsx("small",{children:y.method})]},y.label))]})]},f.component??"")),r&&(i||a)&&m.jsx("dl",{className:"tm-coa-rows",children:i?m.jsx(ue,{label:"Test date",children:i}):m.jsx(ue,{label:"Release date",children:a})}),!r&&m.jsx("p",{className:"tm-coa-note",children:e.status==="withheld"?"This lot did not meet its release specification and was never sold. If a vial carries this number, please contact the team.":"This lot is in the TrueMark catalog. Its results will appear here once the laboratory publishes them."}),e.status==="archived"&&m.jsx("p",{className:"tm-coa-note",children:"This lot has been fully distributed. Its record stays open."}),r&&m.jsxs("p",{className:"tm-coa-links",children:[m.jsxs(Kt,{className:"tm-textlink",to:`/verify?lot=${encodeURIComponent(e.lot)}`,children:["Read the full certificate ",m.jsx(Pr,{size:15,strokeWidth:1.6,"aria-hidden":"true"})]}),h&&m.jsxs("a",{className:"tm-textlink",href:h.href,target:"_blank",rel:"noopener noreferrer",children:["Verify with ",At.name," ",m.jsx(Dr,{size:15,strokeWidth:1.6,"aria-hidden":"true"}),m.jsx("span",{className:"sr-only",children:", opens in a new tab"})]}),(h==null?void 0:h.enter)&&m.jsxs("span",{className:"tm-coa-enter",children:["Enter certificate ",m.jsx("span",{className:"tm-mono",children:h.enter})," there."]})]}),m.jsxs("footer",{className:"tm-coa-foot",children:[m.jsx("span",{children:"Lot traceable to source batch"}),m.jsx("span",{className:"tm-mono",children:e.reference??"Reference pending"})]})]})})}const Wr=.06,Vr=3,qr=40,Xr=28,ie=10,Ve=140,Gr=48,_t=1600,jt=200,we=[1,2,3,4,5].map(e=>`var(--tm-spectrum-${e})`);function dn({peaks:e,height:t=168,className:o=""}){const r=S.useRef(null),[i,a]=S.useState(0),[h,s]=S.useState(!1),u=S.useId().replace(/:/g,""),f=Zt();S.useLayoutEffect(()=>{const c=r.current;if(!c)return;a(Math.round(c.getBoundingClientRect().width));const b=new ResizeObserver(([D])=>a(Math.round(D.contentRect.width)));return b.observe(c),()=>b.disconnect()},[]),S.useEffect(()=>{const c=r.current;if(!c||h)return;const b=new IntersectionObserver(([D])=>{D.isIntersecting&&s(!0)},{threshold:.4});return b.observe(c),()=>b.disconnect()},[h]);const y=e.filter(c=>Number.isFinite(Number(c.retentionTime)));if(!y.length)return null;const T=Math.max(...y.map(c=>Number(c.retentionTime))),L=Math.max(2,Math.ceil(T+1)),w=Math.max(0,i-ie*2)/L,p=c=>ie+c*w,E=t-Xr,n=qr+4,d=E-n,R=Math.max(Vr,Wr*w),A=R*5,F=y.map(c=>({...c,minutes:Number(c.retentionTime),x:p(Number(c.retentionTime)),anchor:"middle"})).sort((c,b)=>c.x-b.x).map((c,b,D)=>{const B=D[b-1],z=D[b+1];let _="middle";return z&&z.x-c.x<Ve?_="end":B&&c.x-B.x<Ve||c.x<Ve/2?_="start":i-c.x<Ve/2&&(_="end"),{...c,anchor:_}}),k=c=>Math.min(d,F.reduce((b,D)=>b+d*Math.exp(-((c-D.x)**2)/(2*R*R)),0)),C=(c,b)=>{let D="";for(let B=Math.max(ie,c);B<=Math.min(i-ie,b);B+=1)D+=`${D?"L":"M"}${B.toFixed(1)},${(E-k(B)).toFixed(1)}`;return D},g=w<30?2:1,P=Array.from({length:L+1},(c,b)=>b),j=w>=Gr,N=P.filter(c=>c===L||c%g===0&&(j||c!==L-1)),W=c=>({"--tm-lot-trace-at":`${Math.round(jt+_t*((c-ie)/Math.max(1,i-ie*2)))}ms`}),M=F.map(c=>`${c.name?`${c.name} at `:"Main peak at "}${c.retentionTime} minutes`).join(", ");return m.jsxs("div",{ref:r,className:`tm-lot-trace ${o}`,style:{height:t,"--tm-lot-trace-draw":`${_t}ms`,"--tm-lot-trace-delay":`${jt}ms`},"data-drawn":h||f?"":void 0,role:"img","aria-label":`${M}. Drawn from the reported retention time${F.length>1?"s":""}.`,children:[i>0&&m.jsxs("svg",{width:i,height:t,viewBox:`0 0 ${i} ${t}`,"aria-hidden":"true",children:[m.jsxs("defs",{children:[F.map((c,b)=>m.jsxs("linearGradient",{id:`${u}g${b}`,gradientUnits:"userSpaceOnUse",x1:c.x-A,x2:c.x+A,y1:"0",y2:"0",children:[m.jsx("stop",{offset:"0",style:{stopColor:we[0],stopOpacity:0}}),m.jsx("stop",{offset:"0.3",style:{stopColor:we[0]}}),m.jsx("stop",{offset:"0.42",style:{stopColor:we[1]}}),m.jsx("stop",{offset:"0.5",style:{stopColor:we[2]}}),m.jsx("stop",{offset:"0.58",style:{stopColor:we[3]}}),m.jsx("stop",{offset:"0.7",style:{stopColor:we[4]}}),m.jsx("stop",{offset:"1",style:{stopColor:we[4],stopOpacity:0}})]},b)),m.jsx("filter",{id:`${u}f`,x:"-50%",y:"-50%",width:"200%",height:"200%",children:m.jsx("feGaussianBlur",{stdDeviation:"4"})})]}),m.jsx("line",{className:"tm-lot-trace-axis",x1:ie,x2:i-ie,y1:E+.5,y2:E+.5}),P.map(c=>m.jsx("line",{className:"tm-lot-trace-tick",x1:p(c),x2:p(c),y1:E+1,y2:E+(c%g===0?6:3)},c)),m.jsx("path",{className:"tm-lot-trace-line",d:C(ie,i-ie)}),F.map((c,b)=>m.jsxs("g",{className:"tm-lot-trace-peak",style:W(c.x),children:[m.jsx("path",{d:C(c.x-A,c.x+A),stroke:`url(#${u}g${b})`,className:"is-glow",filter:`url(#${u}f)`}),m.jsx("path",{d:C(c.x-A,c.x+A),stroke:`url(#${u}g${b})`,className:"is-light"})]},b))]}),i>0&&F.map((c,b)=>m.jsxs("span",{className:`tm-lot-trace-label is-${c.anchor}`,style:{...W(c.x),bottom:t-n+8,...c.anchor==="end"?{right:i-c.x+6}:{left:c.anchor==="start"?c.x+6:c.x}},"aria-hidden":"true",children:[c.name&&m.jsx("span",{className:"tm-lot-trace-name",children:c.name}),m.jsxs("span",{className:"tm-lot-trace-time",children:[c.retentionTime," min"]})]},b)),i>0&&m.jsx("div",{className:"tm-lot-trace-minutes","aria-hidden":"true",children:N.map(c=>m.jsxs("span",{style:{left:p(c)},className:c===0?"is-first":c===L?"is-last":void 0,children:[c,c===L&&m.jsx("i",{children:" min"})]},c))})]})}const Qe=.42,lt={collection:{room:{w:2560,h:1430},horizon:515,focal:3200,wall:1075,pedestals:[{x:626.5,half:135,base:1203,top:1024.3},{x:944.5,half:138,base:1195,top:930.3},{x:1275.5,half:147,base:1203,top:860.7},{x:1610.5,half:138,base:1200,top:946.8},{x:1936,half:136.5,base:1217,top:1049.4}],light:{pedestal:2,reach:1.3}},collectionTall:{room:{w:1080,h:1934},horizon:812,focal:3230,wall:1395,pedestals:[{x:180.5,half:148,base:1455,top:1182.5},{x:536,half:157.5,base:1466,top:1108.2},{x:895.5,half:148,base:1465,top:1200.3}],light:{pedestal:1,reach:1.15}}};function Yt(e){const t=e.focal/(e.wall-e.horizon);return Math.max(0,(e.horizon+(1-Qe)*e.focal/t)/e.room.h-.02)}const ot={blur:6.5,margin:13,feather:230,floorBias:1.6},It=new Map;function Qt(e,t){const o=e.pedestals[t],r=Jt(e,!0).peds[t],i=e.horizon+e.focal*(1-r.h)/(r.z+r.r),a=e.horizon+e.focal/(r.z+r.r);return{x:o.x,half:o.half,top:{cy:(o.top+i)/2,ry:Math.max(4,(o.top-i)/2)},base:{cy:(o.base+a)/2,ry:Math.max(4,(o.base-a)/2)}}}function mn(e,t){const o=Qt(e,t);return{x:o.x,half:o.half,backTop:o.top.cy-o.top.ry,frontTop:o.top.cy+o.top.ry,rimRadius:o.top.ry,base:e.pedestals[t].base}}function Hr(e,t,o){const r=t-e.x;if(o>=e.top.cy&&o<=e.base.cy)return Math.abs(r)-e.half;const i=o<e.top.cy?e.top:e.base,a=o-i.cy,h=r/e.half,s=a/i.ry,u=Math.hypot(h,s);if(u<1e-6)return-Math.min(e.half,i.ry);const f=Math.hypot(r/(e.half*e.half),a/(i.ry*i.ry))/u;return(u-1)/f}function Kr(e,t){if(typeof document>"u"||typeof document.createElement!="function"||!e.pedestals[t])return null;const o=`${e.room.w}x${e.room.h}:${t}`,r=It.get(o);if(r)return r;const i=4,a=Math.ceil(e.room.w/i),h=Math.ceil(e.room.h/i),s=document.createElement("canvas");s.width=a,s.height=h;const u=typeof s.getContext=="function"?s.getContext("2d"):null;if(!u)return null;const f=u.createImageData(a,h),y=Qt(e,t);for(let L=0;L<h;L++){const w=(L+.5)*i,p=w>y.base.cy?1+(ot.floorBias-1)*Math.min(1,(w-y.base.cy)/(y.base.ry*6)):1;for(let E=0;E<a;E++){const n=Hr(y,(E+.5)*i,w)*p,d=Math.min(1,Math.max(0,(n-ot.margin)/ot.feather)),R=d*d*d*(d*(d*6-15)+10);f.data[(L*a+E)*4+3]=Math.round(R*255)}}u.putImageData(f,0,0);const T=`url("${s.toDataURL("image/png")}")`;return It.set(o,T),T}const He=6;function Jt(e,t){const{room:o,horizon:r,focal:i,wall:a}=e,h=o.w/2,s=i/(a-r),u=e.pedestals.map(F=>{const k=i/(F.base-r),C=Math.atan((F.x-F.half-h)/i),g=Math.atan((F.x+F.half-h)/i),P=(C+g)/2,j=(g-C)/2,N=k/(Math.cos(P)-Math.sin(j));return{x:N*Math.sin(P),z:N*Math.cos(P),r:N*Math.sin(j),h:1-(F.top-r)*k/i}}),f=(1-Qe)/((o.h-r)/i),y=h*s/i,T=-y-.12,L=2*(y+.12),w=f-.12,p=t?112:176,E=L/p,n=Math.max(16,Math.round((s+.06-w)/E)),d=new Float32Array(He*4);u.slice(0,He).forEach((F,k)=>d.set([F.x,F.z,F.r,F.h],k*4));const R=u[e.light.pedestal]??{x:0,z:s*.8},A=[R.x,R.z,e.light.reach];return{zWall:s,zNear:f,peds:u,pedUniform:d,xMin:T,xSize:L,zMin:w,zSize:n*E,nx:p,nz:n,cell:E,iterations:t?14:22,spot:A}}const Zr=`#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`,Yr=`#version 300 es
precision highp float;
precision highp int;
out vec4 outColor;
uniform float uLayer;
uniform float uSize;
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 rnd(ivec3 c, int period, uint seed) {
  ivec3 w = (c + period) % period;
  uvec3 h = pcg3d(uvec3(w) + uvec3(seed * 1013u, seed * 7919u, seed * 104729u));
  return vec3(h & uvec3(0xFFFFu)) / 65535.0;
}
float grad(ivec3 i, ivec3 o, vec3 f, int period, uint seed) {
  vec3 g = normalize(rnd(i + o, period, seed) * 2.0 - 1.0 + 1e-4);
  return dot(g, f - vec3(o));
}
float perlin(vec3 p, int period, uint seed) {
  ivec3 i = ivec3(floor(p));
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = grad(i, ivec3(0, 0, 0), f, period, seed);
  float n100 = grad(i, ivec3(1, 0, 0), f, period, seed);
  float n010 = grad(i, ivec3(0, 1, 0), f, period, seed);
  float n110 = grad(i, ivec3(1, 1, 0), f, period, seed);
  float n001 = grad(i, ivec3(0, 0, 1), f, period, seed);
  float n101 = grad(i, ivec3(1, 0, 1), f, period, seed);
  float n011 = grad(i, ivec3(0, 1, 1), f, period, seed);
  float n111 = grad(i, ivec3(1, 1, 1), f, period, seed);
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float worley(vec3 p, int period, uint seed) {
  ivec3 i = ivec3(floor(p));
  vec3 f = fract(p);
  float md = 8.0;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    ivec3 o = ivec3(x, y, z);
    vec3 d = vec3(o) + rnd(i + o, period, seed + 17u) - f;
    md = min(md, dot(d, d));
  }
  return sqrt(md);
}
void main() {
  vec3 p = vec3(gl_FragCoord.xy, uLayer + 0.5) / uSize;
  float a = perlin(p * 4.0, 4, 1u);
  float b = perlin(p * 8.0, 8, 2u);
  float c = 1.0 - worley(p * 4.0, 4, 3u);
  float d = 1.0 - worley(p * 8.0, 8, 4u);
  outColor = clamp(vec4(a * 0.9 + 0.5, b * 0.9 + 0.5, c, d), 0.0, 1.0);
}`,le=`#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uTexel;
`,Qr=`${le}
uniform sampler2D uVel;
void main() {
  float L = texture(uVel, vUv - vec2(uTexel.x, 0.0)).y;
  float R = texture(uVel, vUv + vec2(uTexel.x, 0.0)).y;
  float B = texture(uVel, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uVel, vUv + vec2(0.0, uTexel.y)).x;
  outColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,Jr=`${le}
uniform sampler2D uVel;
uniform sampler2D uCurl;
uniform sampler2D uFloor;
uniform sampler3D uNoise;
uniform vec4 uWorld;
uniform vec2 uWind;
uniform float uDt;
uniform float uConfine;
uniform float uStir;
uniform float uRelax;
uniform float uTime;
uniform float uCell;
void main() {
  float L = abs(texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x);
  float R = abs(texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x);
  float B = abs(texture(uCurl, vUv - vec2(0.0, uTexel.y)).x);
  float T = abs(texture(uCurl, vUv + vec2(0.0, uTexel.y)).x);
  float C = texture(uCurl, vUv).x;
  vec2 f = 0.5 * vec2(T - B, R - L);
  f /= length(f) + 1e-4;
  f *= uConfine * C;
  f.y = -f.y;
  vec2 v = texture(uVel, vUv).xy + f * uDt;
  vec2 w = uWorld.xy + vUv * uWorld.zw;
  vec3 c = vec3(w * 0.21, uTime * 0.011);
  const float e = 0.015;
  float px = texture(uNoise, c + vec3(e, 0.0, 0.0)).r - texture(uNoise, c - vec3(e, 0.0, 0.0)).r;
  float pz = texture(uNoise, c + vec3(0.0, e, 0.0)).r - texture(uNoise, c - vec3(0.0, e, 0.0)).r;
  v += vec2(pz, -px) / (2.0 * e) * uStir * uDt / uCell;
  v = uWind + (v - uWind) * uRelax;
  v *= 1.0 - texture(uFloor, vUv).g;
  outColor = vec4(v, 0.0, 1.0);
}`,eo=`${le}
uniform sampler2D uVel;
void main() {
  float L = texture(uVel, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uVel, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uVel, vUv - vec2(0.0, uTexel.y)).y;
  float T = texture(uVel, vUv + vec2(0.0, uTexel.y)).y;
  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,to=`${le}
uniform sampler2D uSrc;
uniform float uK;
void main() { outColor = texture(uSrc, vUv) * uK; }`,ro=`${le}
uniform sampler2D uP;
uniform sampler2D uDiv;
void main() {
  float L = texture(uP, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uP, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uP, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uP, vUv + vec2(0.0, uTexel.y)).x;
  float d = texture(uDiv, vUv).x;
  outColor = vec4((L + R + B + T - d) * 0.25, 0.0, 0.0, 1.0);
}`,oo=`${le}
uniform sampler2D uP;
uniform sampler2D uVel;
uniform sampler2D uFloor;
void main() {
  float L = texture(uP, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uP, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uP, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uP, vUv + vec2(0.0, uTexel.y)).x;
  vec2 v = texture(uVel, vUv).xy - 0.5 * vec2(R - L, T - B);
  v *= 1.0 - texture(uFloor, vUv).g;
  outColor = vec4(v, 0.0, 1.0);
}`,no=`${le}
uniform sampler2D uVel;
uniform float uDt;
void main() {
  vec2 back = vUv - uDt * texture(uVel, vUv).xy * uTexel;
  outColor = texture(uVel, back);
}`,io=`${le}
uniform sampler2D uVel;
uniform sampler2D uState;
uniform vec2 uWind;
uniform float uDt;
uniform float uCell;
uniform float uKeepD;
uniform float uKeepT;
uniform float uDiffuse;
void main() {
  vec2 v = texture(uVel, vUv).xy;
  vec2 back = vUv - uDt * v * uTexel;
  vec4 s = texture(uState, back);
  float n = texture(uState, back + vec2(0.0, uTexel.y)).z + texture(uState, back - vec2(0.0, uTexel.y)).z
          + texture(uState, back + vec2(uTexel.x, 0.0)).z + texture(uState, back - vec2(uTexel.x, 0.0)).z;
  s.z = mix(s.z, n * 0.25, uDiffuse);
  s.xy = clamp((s.xy + (v - uWind) * uCell * uDt) * uKeepD, vec2(-0.9), vec2(0.9));
  s.z = 1.0 + (s.z - 1.0) * uKeepT;
  outColor = s;
}`,so=`${le}
uniform sampler2D uSrc;
uniform sampler3D uNoise;
uniform vec4 uWorld;
uniform vec2 uA;
uniform vec2 uB;
uniform vec2 uGrid;
uniform float uCore;
uniform float uRadius;
uniform vec2 uBodyVel;
uniform float uDrag;
uniform float uSwirl;
uniform float uPhase;
uniform float uThin;
uniform float uRidge;
uniform int uMode;
void main() {
  vec2 p = vUv * uGrid;
  vec2 a = uA * uGrid, b = uB * uGrid;
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  float d = length(pa - ba * h);
  float core = exp(-d * d / (uCore * uCore));
  float reach = exp(-d * d / (uRadius * uRadius));
  vec4 s = texture(uSrc, vUv);
  vec2 w = uWorld.xy + vUv * uWorld.zw;
  if (uMode == 0) {
    s.xy = mix(s.xy, uBodyVel, reach * uDrag);
    vec3 c = vec3(w * 0.8, uPhase);
    const float e = 0.01;
    float px = texture(uNoise, c + vec3(e, 0.0, 0.0)).r - texture(uNoise, c - vec3(e, 0.0, 0.0)).r;
    float pz = texture(uNoise, c + vec3(0.0, e, 0.0)).r - texture(uNoise, c - vec3(0.0, e, 0.0)).r;
    vec2 g = vec2(pz, -px) / (2.0 * e) * 0.8;
    s.xy += g * uSwirl * reach;
  } else {
    float patchy = texture(uNoise, vec3(w * 0.9, 0.37)).g;
    s.z *= exp(-uThin * core * (0.3 + 1.4 * patchy));
    s.z *= 1.0 + uRidge * max(reach - core, 0.0);
    s.z = min(s.z, 1.6);
  }
  outColor = s;
}`,ao=`#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv;
out vec4 outColor;
uniform sampler3D uNoise;
uniform sampler2D uState;
uniform sampler2D uFloor;
uniform vec4 uRegion;
uniform vec2 uRoom;
uniform float uHorizon;
uniform float uFocal;
uniform float uWallZ;
uniform vec4 uWorld;
uniform vec4 uPed[${He}];
uniform int uPedCount;
uniform float uTime;
uniform vec2 uDrift;
uniform float uTop;
uniform float uPile;
uniform float uClimb;
uniform float uFirm;
uniform float uSigma;
uniform float uTurb;
uniform float uLight;
uniform float uSteps;
uniform float uZNear;
uniform vec3 uLit;
uniform vec3 uShade;
uniform vec3 uSun;
uniform vec3 uSpot;
uniform vec2 uRoomLight;
uniform sampler2D uHistory;
uniform float uBlend;
uniform float uFrame;
const float SLAB = ${Qe.toFixed(3)};

/* Where along its first step each pixel's march starts: interleaved gradient noise, moved on each frame (64 to a
   cycle). Neighbouring pixels and successive frames start far apart, so the few frames the history averages, and the
   eye across a few pixels, see the whole step covered: a smooth mist, not a grain. */
float startAt(vec2 p) {
  p += 5.588238 * uFrame;
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

/* The mist's body at a height: its surface lifted into soft rounded billows and broken into wisps.
   'mid' scales the middle structure (softer near the camera), 'fine' the finest (gone where the march
   can't resolve it). uFirm is how far up (a share of its top) it stays dense before rolling off: low, a
   haze thinning all the way up; higher, a bank with a surface its billows show on. */
float body(vec2 q, float y, float top, float mid, float fine) {
  vec3 dq = vec3(q.x, y * 2.2, q.y);
  vec4 n1 = texture(uNoise, dq * 0.34 + vec3(0.0, -uTime * 0.013, uTime * 0.0035));
  vec3 w = vec3(n1.g - 0.5, 0.0, n1.r - 0.5) * 0.35;
  vec4 n2 = texture(uNoise, (dq + w) * 1.45 + vec3(0.37, -uTime * 0.034, 0.11 + uTime * 0.006));
  float billow = n2.b * (2.0 - n2.b);
  float lift = ((n1.r - 0.5) * 1.2 + (n1.g - 0.5) * 0.8 + (billow - 0.72) * 1.3) * mid
             + ((n2.a - 0.55) * 0.8 + (n2.r - 0.5) * 0.6) * fine;
  float rel = (y - lift * top * uTurb) / max(top, 1e-3);
  float b = 1.0 - smoothstep(uFirm, 1.1, rel);
  return b * mix(b, 1.0, 0.35) * (0.45 + 0.8 * exp(-y / (0.42 * top + 0.008)));
}

void main() {
  vec2 px = vec2(mix(uRegion.x, uRegion.z, vUv.x), mix(uRegion.w, uRegion.y, vUv.y)) * uRoom;
  vec3 rd = vec3((px.x - 0.5 * uRoom.x) / uFocal, -(px.y - uHorizon) / uFocal, 1.0);
  vec4 prev = texelFetch(uHistory, ivec2(gl_FragCoord.xy), 0);
  outColor = prev * (1.0 - uBlend);
  if (rd.y > -1e-4) return;
  // From the camera (one unit above the floor) down through the slab of mist, to the floor, the back
  // wall, or a pedestal (its near side, or its top seen from above), whichever comes first. z equals t
  // along this ray.
  float t0 = (1.0 - SLAB) / -rd.y;
  float t1 = min(1.0 / -rd.y, uWallZ);
  for (int i = 0; i < ${He}; i++) {
    if (i >= uPedCount) break;
    vec4 pd = uPed[i];
    vec2 oc = -pd.xy;
    float a = dot(rd.xz, rd.xz), b = dot(oc, rd.xz), c = dot(oc, oc) - pd.z * pd.z;
    float disc = b * b - a * c;
    if (disc > 0.0) {
      float th = (-b - sqrt(disc)) / a;
      if (th > 0.0) {
        if (1.0 + rd.y * th < pd.w) t1 = min(t1, th);
        else {
          // Over the side's top edge: the ray comes down onto the top if it lands inside it.
          float tt = (1.0 - pd.w) / -rd.y;
          vec2 land = rd.xz * tt - pd.xy;
          if (dot(land, land) < pd.z * pd.z) t1 = min(t1, tt);
        }
      }
    }
  }
  if (t1 <= t0) return;
  float len = length(rd);
  float dt = (t1 - t0) / uSteps;
  float stepLen = dt * len;
  // The finest structure only where the march resolves it; elsewhere it would only be grain.
  float resolve = 1.0 - smoothstep(0.035, 0.1, stepLen);
  float t = t0 + dt * startAt(gl_FragCoord.xy);
  float trans = 1.0;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 64; i++) {
    if (float(i) >= uSteps || trans < 0.01) break;
    vec3 p = vec3(0.0, 1.0, 0.0) + rd * t;
    vec2 suv = (p.xz - uWorld.xy) / uWorld.zw;
    vec4 st = texture(uState, suv);
    vec4 ground = texture(uFloor, suv);
    float pool = ground.r;
    // The most the mist may reach here: near a pedestal, well under the vial standing on its top.
    float ceiling = ground.b * SLAB;
    vec2 q = p.xz - st.xy + uDrift;
    // Slow banks: where the layer runs thick and thin.
    float b1 = texture(uNoise, vec3(q * 0.085, uTime * 0.0021)).r;
    float b2 = texture(uNoise, vec3(q * 0.21 + 0.31, uTime * 0.0043 + 0.5)).g;
    float bank = clamp(0.5 + (b1 - 0.5) * 1.6 + (b2 - 0.5) * 0.9, 0.0, 1.0);
    // Close to the back wall the mist lies flatter and thinner; it piles up against each pedestal.
    float far = smoothstep(uWallZ - 0.8, uWallZ, p.z);
    float top = uTop * mix(0.5, 1.45, bank) * (1.0 + uPile * pool) * mix(1.0, 0.62, far) * st.z;
    // Now and then a wisp climbs higher: sparse, slow and rounded, mostly where the bank piles against a
    // pedestal, carried round its sides by the air.
    float plume = smoothstep(0.6, 0.9, texture(uNoise, vec3(q * 0.42 + vec2(0.71, 0.13), uTime * 0.0045 + 0.61)).b);
    top *= 1.0 + uClimb * plume * (0.35 + 0.65 * pool);
    // Ease it under the ceiling, softly, so the bank keeps its rise and fall under a low ceiling instead of
    // being cut flat; the rare billow that rides higher still fades out below the ceiling (see d).
    float cap = ceiling * 0.75;
    float knee = 0.7 * cap;
    if (top > knee) top = knee + (cap - knee) * (1.0 - exp(-(top - knee) / (cap - knee)));
    // Near the camera the mist is out of focus: larger, softer, its finest structure gone.
    float focus = smoothstep(uZNear + 0.1, uZNear + 1.5, p.z);
    float mid = mix(0.55, 1.0, focus);
    float fine = mix(0.15, 1.0, focus) * resolve;
    float thin = mix(1.0, 0.55, far) * mix(0.6, 1.0, focus);
    thin *= sqrt(clamp(st.z, 0.0, 1.6));
    float d = body(q, p.y, top, mid, fine) * thin * (1.0 - smoothstep(ceiling - 0.04, ceiling, p.y));
    if (d > 0.002) {
      // Self-shadowing toward the light overhead: brighter where the mist thins toward it, so its billows' tops catch
      // it and their undersides fall into shade.
      float dl = body(q + uSun.xz * 0.07, p.y + uSun.y * 0.07, top, mid, fine) * thin;
      float lit = clamp((d - dl) * 2.6 / (d + 0.25), 0.0, 1.0);
      float up = clamp(p.y / max(top, 1e-3), 0.0, 1.0);
      // The light's pool: full under it, falling off softly into the room.
      vec2 off = (p.xz - uSpot.xy) / uSpot.z;
      float inLight = exp(-dot(off, off));
      float k = clamp(0.56 + (0.3 * up + lit * 0.62 - 0.36) * uLight, 0.0, 1.0);
      vec3 col = mix(uShade, uLit, k) * mix(uRoomLight.x, 1.0, inLight);
      col = min(col * (1.0 + uRoomLight.y * inLight * min(d * 2.0, 1.0)), vec3(1.0));
      float a = 1.0 - exp(-d * uSigma * stepLen);
      acc += trans * a * col;
      trans *= 1.0 - a;
    }
    t += dt;
  }
  // The camera never moves, so each frame's samples (jittered differently) average into the last
  // few: the same mist, without the grain of any one frame's samples.
  outColor = mix(prev, vec4(acc, 1.0 - trans), uBlend);
}`,uo=`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSrc;
float hash(vec2 p) {
  uvec2 q = uvec2(ivec2(p)) * uvec2(1597334673u, 3812015801u);
  uint n = (q.x ^ q.y) * 1597334673u;
  return float(n) * (1.0 / 4294967295.0);
}
void main() {
  vec4 c = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0);
  float g = (hash(gl_FragCoord.xy + vec2(7919.0, 104.0)) - 0.5) / 255.0;
  float a = clamp(c.a + g, 0.0, 1.0);
  outColor = vec4(clamp(c.rgb + g, vec3(0.0), vec3(a)), a);
}`,er={alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!1,powerPreference:"high-performance"};async function co(e,t={},o=()=>!1){var s;const r=e.getContext("webgl2",er),i=r==null?void 0:r.getExtension("KHR_parallel_shader_compile");if(!r||!i)return o()?null:ft(e,t);const a=tr(r),h=Object.values(a);for(;!h.every(({p:u})=>r.getProgramParameter(u,i.COMPLETION_STATUS_KHR));)if(await new Promise(u=>requestAnimationFrame(u)),o()||r.isContextLost()){for(const{p:u}of h)r.deleteProgram(u);return(s=r.getExtension("WEBGL_lose_context"))==null||s.loseContext(),null}return ft(e,t,a)}const nt=[{scale:1,steps:1},{scale:.84,steps:.84},{scale:.7,steps:.7},{scale:.56,steps:.6}],Pe={top:.1,pile:.7,climb:.7,sigma:1.9,firm:.4},De={core:.18,reach:.34,swirl:.6,thin:1.8,ridge:.14,refill:4},lo=32,qe=.3,fo=[228/255,216/255,245/255],mo=[200/255,187/255,226/255],ho=go([0,1,.12]),kt={dim:.9,glow:.16},it=3.4;function ft(e,t={},o){const r=t.scene??lt.collection,i={density:t.density??1,depth:t.depth??1,climb:t.climb??1,drift:t.drift??1,turbulence:t.turbulence??1,light:t.light??1,pointer:t.pointer??1},a={...i},h=Object.fromEntries(Object.keys(i).map(l=>[l,0]));function s(l){for(const x of Object.keys(a)){const v=a[x]-i[x];if(Math.abs(v)<1e-4&&Math.abs(h[x])<1e-4){i[x]=a[x],h[x]=0;continue}h[x]+=(it*it*v-2*it*h[x])*l,i[x]+=h[x]*l}}function u(){Object.assign(i,a);for(const l of Object.keys(h))h[l]=0}const f=t.quality==="low",y=t.interactive??!0,T=t.autoPause??!0,L=t.adapt??!0;let w=t.still??!1;const p=l=>{var x;try{(x=t.onFallback)==null||x.call(t,l)}catch{}return null},E=e.getContext("webgl2",er);if(!E)return p("webgl2");const n=E;if(!n.getExtension("EXT_color_buffer_float"))return p("float-targets");const d=Jt(r,f);let R=t.region??{x0:0,y0:Yt(r),x1:1,y1:1},A;try{A=vo(n,o??tr(n))}catch(l){return console.warn("[fog]",l instanceof Error?l.message:l),p("shader")}const F=n.createVertexArray();n.bindVertexArray(F);const k=n.createBuffer();n.bindBuffer(n.ARRAY_BUFFER,k),n.bufferData(n.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),n.STATIC_DRAW),n.enableVertexAttribArray(0),n.vertexAttribPointer(0,2,n.FLOAT,!1,0,0),n.disable(n.BLEND),n.disable(n.DEPTH_TEST);const C=yo(n,A.noise,f?48:64);let g;try{g=P()}catch(l){return console.warn("[fog]",l instanceof Error?l.message:l),p("float-targets")}function P(){const{nx:l,nz:x}=d,v=(O=n.LINEAR)=>st(n,l,x,O),V=()=>{let O=v(),q=v();return{get read(){return O},get write(){return q},swap(){[O,q]=[q,O]},all:()=>[O,q]}},U={vel:V(),state:V(),pres:V(),curl:v(n.NEAREST),div:v(n.NEAREST),floor:wo(n,d,vt(1))};return j(U),U}function j(l){const x=B(0);for(const v of l.vel.all())N(v,[x[0],x[1],0,1]);for(const v of l.state.all())N(v,[0,0,1,1]);for(const v of l.pres.all())N(v,[0,0,0,1])}function N(l,x){n.bindFramebuffer(n.FRAMEBUFFER,l.fb),n.viewport(0,0,l.w,l.h),n.clearBufferfv(n.COLOR,0,x)}function W(l){for(const x of[l.vel,l.state,l.pres])for(const v of x.all())Ue(n,v);Ue(n,l.curl),Ue(n,l.div),n.deleteTexture(l.floor)}let M=0,c=37;const b=[0,0];function D(l){const x=i.drift,v=1+.25*Math.sin(l*.071)+.15*Math.sin(l*.023+1.3);return[.022*x*v,-.008*x*(1+.4*Math.sin(l*.041+.7))]}function B(l){const x=D(l);return[x[0]/d.cell,x[1]/d.cell]}const z={x:0,y:0,active:!1,moved:!1,prev:null,prevTime:0};let _=e.getBoundingClientRect(),K=0;function J(l,x){if(performance.now()-K>250&&(_=e.getBoundingClientRect(),K=performance.now()),!_.width||!_.height)return null;const v=(l-_.left)/_.width,V=(x-_.top)/_.height;if(v<-.05||v>1.05||V<-.2||V>1.05)return null;const{room:U,focal:O,horizon:q}=r,I=(R.x0+v*(R.x1-R.x0))*U.w,me=(R.y0+V*(R.y1-R.y0))*U.h,ne=(I-U.w/2)/O,X=-(me-q)/O;if(X>-1e-4)return null;let Y=(1-.08)/-X;for(const Z of d.peds){const H=ne*ne+1,ae=-2*(ne*Z.x+Z.z),he=Z.x*Z.x+Z.z*Z.z-Z.r*Z.r,ze=ae*ae-4*H*he;if(ze<=0)continue;const Oe=(-ae-Math.sqrt(ze))/(2*H);if(Oe>0&&Oe<Y){if(1+X*Oe>.36)return null;Y=Oe}}if(Y>d.zWall){if(1+X*d.zWall>.45)return null;Y=d.zWall-.03}return{x:ne*Y,z:Y}}const Be=t.scale??(f?.95:.8),ye=t.maxPixels??(f?36e4:11e5);let re=t.zoom&&t.zoom>0?t.zoom:1,fe={w:0};const vr=f?26:36;let de=0;function vt(l){return d.peds.map(x=>lo/l*(x.z-x.r)/r.focal)}let xt=0;function ge(){_=e.getBoundingClientRect(),K=performance.now();const l=e.clientWidth/re,x=e.clientHeight/re;if(!e.isConnected||!l||!x)return;fe={w:l,h:x};const v=l/(r.room.w*(R.x1-R.x0));v>0&&Math.abs(v/xt-1)>.02&&(xt=v,rr(n,g.floor,d,vt(v)));const V=Math.sqrt(ye/Math.max(1,l*x)),U=Math.min(Be,V)*nt[de].scale,O=Math.max(2,Math.round(l*U)),q=Math.max(2,Math.round(x*U)),I=e.width!==O||e.height!==q;I&&(e.width=O,e.height=q),!(Te||!I)&&(w?Ee():Fe())}function $(l,x,v=!1){return n.activeTexture(n.TEXTURE0+l),n.bindTexture(v?n.TEXTURE_3D:n.TEXTURE_2D,x),l}function oe(l){n.bindFramebuffer(n.FRAMEBUFFER,l?l.fb:null),n.drawArrays(n.TRIANGLES,0,3)}function ee(l){return n.useProgram(l.p),l.u.uTexel&&n.uniform2f(l.u.uTexel,1/d.nx,1/d.nz),l.u}function xr(l,x,v,V,U,O,q){const I=ee(A.splat),me=ze=>[(ze.x-d.xMin)/d.xSize,(ze.z-d.zMin)/d.zSize],ne=me(l),X=me(x),te=i.pointer,{core:Y,reach:Z}=De,H=Xe(.15,1.2,U)*te,ae=Math.min(O/Y,2),he=U/d.cell;n.uniform2f(I.uA,ne[0],ne[1]),n.uniform2f(I.uB,X[0],X[1]),n.uniform2f(I.uGrid,d.nx,d.nz),n.uniform4f(I.uWorld,d.xMin,d.zMin,d.xSize,d.zSize),n.uniform1i(I.uNoise,$(1,C,!0)),n.uniform1f(I.uCore,Y/d.cell),n.uniform1f(I.uRadius,Z/d.cell),n.uniform2f(I.uBodyVel,v/d.cell,V/d.cell),n.uniform1f(I.uDrag,Math.min(1-Math.exp(-1.4*H*q),.5)),n.uniform1f(I.uSwirl,De.swirl*he*H*q),n.uniform1f(I.uPhase,.5+M*.013),n.uniform1f(I.uThin,De.thin*H*ae),n.uniform1f(I.uRidge,De.ridge*H*ae),n.uniform1i(I.uSrc,$(0,g.vel.read.tex)),n.uniform1i(I.uMode,0),n.viewport(0,0,d.nx,d.nz),oe(g.vel.write),g.vel.swap(),n.uniform1i(I.uSrc,$(0,g.state.read.tex)),n.uniform1i(I.uMode,1),oe(g.state.write),g.state.swap()}function wt(l){M+=l,c+=l*i.drift;const x=D(M);b[0]-=x[0]*l,b[1]-=x[1]*l;const v=[x[0]/d.cell,x[1]/d.cell];if(y&&i.pointer>0&&z.active&&z.moved){z.moved=!1;const te=J(z.x,z.y);if(te&&z.prev){const Y=te.x-z.prev.x,Z=te.z-z.prev.z,H=Math.hypot(Y,Z),ae=Math.max(M-z.prevTime,1/120);if(H>1e-4&&H<.9){const he=Math.min(H/ae,2.2);he>.05&&xr(z.prev,te,Y/H*he,Z/H*he,he,H,Math.min(ae,1/20))}}z.prev=te,z.prevTime=M}n.viewport(0,0,d.nx,d.nz);const V=ee(A.curl);n.uniform1i(V.uVel,$(0,g.vel.read.tex)),oe(g.curl);const U=ee(A.force);n.uniform1i(U.uVel,$(0,g.vel.read.tex)),n.uniform1i(U.uCurl,$(1,g.curl.tex)),n.uniform1i(U.uFloor,$(2,g.floor)),n.uniform1i(U.uNoise,$(3,C,!0)),n.uniform4f(U.uWorld,d.xMin,d.zMin,d.xSize,d.zSize),n.uniform2f(U.uWind,v[0],v[1]),n.uniform1f(U.uDt,l),n.uniform1f(U.uConfine,2.4*i.turbulence),n.uniform1f(U.uStir,.003*i.turbulence*i.drift),n.uniform1f(U.uRelax,Math.exp(-l/3.6)),n.uniform1f(U.uTime,c),n.uniform1f(U.uCell,d.cell),oe(g.vel.write),g.vel.swap();const O=ee(A.divergence);n.uniform1i(O.uVel,$(0,g.vel.read.tex)),oe(g.div);const q=ee(A.scale);n.uniform1i(q.uSrc,$(0,g.pres.read.tex)),n.uniform1f(q.uK,.8),oe(g.pres.write),g.pres.swap();const I=ee(A.pressure);n.uniform1i(I.uDiv,$(1,g.div.tex));for(let te=0;te<d.iterations;te++)n.uniform1i(I.uP,$(0,g.pres.read.tex)),oe(g.pres.write),g.pres.swap();const me=ee(A.gradient);n.uniform1i(me.uP,$(0,g.pres.read.tex)),n.uniform1i(me.uVel,$(1,g.vel.read.tex)),n.uniform1i(me.uFloor,$(2,g.floor)),oe(g.vel.write),g.vel.swap();const ne=ee(A.advect);n.uniform1i(ne.uVel,$(0,g.vel.read.tex)),n.uniform1f(ne.uDt,l),oe(g.vel.write),g.vel.swap();const X=ee(A.state);n.uniform1i(X.uVel,$(0,g.vel.read.tex)),n.uniform1i(X.uState,$(1,g.state.read.tex)),n.uniform2f(X.uWind,v[0],v[1]),n.uniform1f(X.uDt,l),n.uniform1f(X.uCell,d.cell),n.uniform1f(X.uKeepD,Math.exp(-l/9)),n.uniform1f(X.uKeepT,Math.exp(-l/De.refill)),n.uniform1f(X.uDiffuse,Math.min(1,9*l)),oe(g.state.write),g.state.swap()}let G=null,Ae=!0,Je=0;function wr(){if(G&&G.w===e.width&&G.h===e.height)return G;if(G)for(const v of G.both)Ue(n,v);const l=st(n,e.width,e.height,n.NEAREST),x=st(n,e.width,e.height,n.NEAREST);return G={w:e.width,h:e.height,read:l,write:x,both:[l,x]},Ae=!0,G}function Fe(l=1){const x=wr(),v=ee(A.render);n.uniform1i(v.uHistory,$(3,x.read.tex)),n.uniform1f(v.uBlend,Ae?1:l),Je=(Je+1)%64,n.uniform1f(v.uFrame,Je);const{room:V,focal:U,horizon:O}=r;n.uniform1i(v.uNoise,$(0,C,!0)),n.uniform1i(v.uState,$(1,g.state.read.tex)),n.uniform1i(v.uFloor,$(2,g.floor)),n.uniform4f(v.uRegion,R.x0,R.y0,R.x1,R.y1),n.uniform2f(v.uRoom,V.w,V.h),n.uniform1f(v.uHorizon,O),n.uniform1f(v.uFocal,U),n.uniform1f(v.uWallZ,d.zWall),n.uniform4f(v.uWorld,d.xMin,d.zMin,d.xSize,d.zSize),n.uniform4fv(v.uPed,d.pedUniform),n.uniform1i(v.uPedCount,d.peds.length),n.uniform1f(v.uTime,c),n.uniform2f(v.uDrift,b[0],b[1]),n.uniform1f(v.uTop,Pe.top*i.depth*(.75+.25*i.density)),n.uniform1f(v.uPile,Pe.pile*i.depth),n.uniform1f(v.uClimb,Pe.climb*i.climb),n.uniform1f(v.uFirm,Pe.firm),n.uniform1f(v.uSigma,Pe.sigma*i.density),n.uniform1f(v.uTurb,.25+.75*i.turbulence),n.uniform1f(v.uLight,i.light),n.uniform1f(v.uSteps,Math.max(8,Math.round(vr*nt[de].steps))),n.uniform1f(v.uZNear,d.zNear),n.uniform3fv(v.uLit,fo),n.uniform3fv(v.uShade,mo),n.uniform3fv(v.uSun,ho),n.uniform3fv(v.uSpot,d.spot),n.uniform2f(v.uRoomLight,kt.dim,kt.glow),n.bindFramebuffer(n.FRAMEBUFFER,x.write.fb),n.viewport(0,0,e.width,e.height),n.drawArrays(n.TRIANGLES,0,3),[x.read,x.write]=[x.write,x.read],Ae=!1,yt(x.read)}function yt(l){const x=ee(A.present);n.uniform1i(x.uSrc,$(0,l.tex)),n.bindFramebuffer(n.FRAMEBUFFER,null),n.viewport(0,0,e.width,e.height),n.drawArrays(n.TRIANGLES,0,3)}function yr(){Te||(ge(),G&&G.w===e.width&&G.h===e.height&&!Ae?yt(G.read):w?Ee():Fe())}function Ee(){if(!Te){Ae=!0;for(let l=0;l<16;l++)Fe(1/(l+1))}}function gr(l){const x=Math.round(l*30);for(let v=0;v<x;v++)wt(1/30)}let Ce=0,be=!1,Te=!1,et=!1,gt=!0,$e=0,tt=0,Et=0,bt=0;const Re=[],Le={fps:0,tier:0,frames:0,fallback:null};function Tt(l){Ce=requestAnimationFrame(Tt);const x=$e?l-$e:16.7;if($e=l,x>250)return;const v=Math.min(x/1e3,1/30);s(v),wt(v),Fe(1-Math.exp(-v/.06)),Le.frames++,Er(x,l)}function Er(l,x){if(x<tt||(Re.length||(Et=x),Re.push(l),x-Et<1500&&Re.length<120))return;const v=Re.slice().sort((q,I)=>q-I),V=v[v.length>>1];Re.length=0;const U=1e3/V;if(Le.fps=Math.round(U*10)/10,!L)return;const O=nt.length-1;U<48&&de<O?(de=U<30?O:de+1,Le.tier=de,ge(),tt=x+500):de===O&&U<34?(U<24||++bt>=2)&&(Le.fallback="slow",rt(),p("slow")):bt=0}function xe(){const l=!Te&&!w&&!et&&gt&&!document.hidden;l&&!be?(be=!0,$e=0,tt=performance.now()+750,Re.length=0,Ce=requestAnimationFrame(Tt)):!l&&be&&(be=!1,cancelAnimationFrame(Ce),Ce=0)}let Ne=null;const Rt=()=>xe();T&&(Ne=new IntersectionObserver(([l])=>{gt=l.isIntersecting,xe()}),Ne.observe(e),document.addEventListener("visibilitychange",Rt));const Lt=new ResizeObserver(()=>ge());Lt.observe(e);const St=l=>{l.preventDefault(),Le.fallback="context-lost",rt(),p("context-lost")};e.addEventListener("webglcontextlost",St);function rt(){var l;if(!Te&&(Te=!0,be=!1,cancelAnimationFrame(Ce),Ne==null||Ne.disconnect(),Lt.disconnect(),document.removeEventListener("visibilitychange",Rt),e.removeEventListener("webglcontextlost",St),!n.isContextLost())){if(W(g),G)for(const x of G.both)Ue(n,x);n.deleteTexture(C);for(const x of Object.values(A))n.deleteProgram(x.p);n.deleteBuffer(k),n.deleteVertexArray(F),(l=n.getExtension("WEBGL_lose_context"))==null||l.loseContext()}}return ge(),gr(w?2.5:1.5),w?Ee():(Fe(),xe()),{setPointer(l,x){!y||w||(z.active||(z.prev=null,z.active=!0),z.x=l,z.y=x,z.moved=!0)},releasePointer(){z.active=!1,z.prev=null},set(l){Object.assign(a,l),w&&(u(),Ee())},get params(){return{...i}},setRegion(l){R={...l},w&&Ee()},setZoom(l){!(l>0)||Math.abs(l/re-1)<1e-4||(re=l,ge())},adopt(){const l=e.clientWidth;fe.w>0&&l>0&&(re=l/fe.w)},setStill(l){l!==w&&(w=l,w?(z.active=!1,xe(),u(),Ee()):xe())},resize:ge,redraw:yr,pause(){et=!0,xe()},resume(){et=!1,xe()},destroy:rt,get stats(){return{...Le,tier:de,width:e.width,height:e.height,grid:[d.nx,d.nz],running:be}}}}const po={noise:Yr,curl:Qr,force:Jr,divergence:eo,scale:to,pressure:ro,gradient:oo,advect:no,state:io,splat:so,render:ao,present:uo};function tr(e){const t=(r,i)=>{const a=e.createShader(r);if(!a)throw new Error("fog: no shader");return e.shaderSource(a,i),e.compileShader(a),a},o={};for(const[r,i]of Object.entries(po)){const a=e.createProgram(),h=t(e.VERTEX_SHADER,Zr),s=t(e.FRAGMENT_SHADER,i);e.attachShader(a,h),e.attachShader(a,s),e.bindAttribLocation(a,0,"aPos"),e.linkProgram(a),o[r]={p:a,v:h,f:s}}return o}function vo(e,t){return{noise:Q(e,t.noise,["uLayer","uSize"]),curl:Q(e,t.curl,["uVel"]),force:Q(e,t.force,["uVel","uCurl","uFloor","uNoise","uWorld","uWind","uDt","uConfine","uStir","uRelax","uTime","uCell"]),divergence:Q(e,t.divergence,["uVel"]),scale:Q(e,t.scale,["uSrc","uK"]),pressure:Q(e,t.pressure,["uP","uDiv"]),gradient:Q(e,t.gradient,["uP","uVel","uFloor"]),advect:Q(e,t.advect,["uVel","uDt"]),state:Q(e,t.state,["uVel","uState","uWind","uDt","uCell","uKeepD","uKeepT","uDiffuse"]),splat:Q(e,t.splat,["uSrc","uNoise","uWorld","uA","uB","uGrid","uCore","uRadius","uBodyVel","uDrag","uSwirl","uPhase","uThin","uRidge","uMode"]),render:Q(e,t.render,["uNoise","uState","uFloor","uRegion","uRoom","uHorizon","uFocal","uWallZ","uWorld","uPed","uPedCount","uTime","uDrift","uTop","uPile","uClimb","uFirm","uSigma","uTurb","uLight","uSteps","uZNear","uLit","uShade","uSun","uSpot","uRoomLight","uHistory","uBlend","uFrame"]),present:Q(e,t.present,["uSrc"])}}function xo(e,t){const{nx:o,nz:r}=e,i=new Uint8Array(o*r*4);for(let a=0;a<r;a++)for(let h=0;h<o;h++){const s=e.xMin+(h+.5)/o*e.xSize,u=e.zMin+(a+.5)/r*e.zSize;let f=0,y=0,T=qe,L=1/0;e.peds.forEach((E,n)=>{const d=Math.hypot(s-E.x,u-E.z)-E.r;f+=Math.exp(-Math.max(d,0)/.16),y=Math.max(y,Xe(e.cell,-e.cell,d));const R=E.h-t[n];R>qe&&(T=Math.max(T,qe+(R-qe)*(1-Xe(.2,.7,d))));const A=Math.hypot(E.x,E.z),F=(s*E.x+u*E.z)/A,k=Math.abs(s*E.z-u*E.x)/A,C=E.r*F/A,g=1-Xe(C,C*1.3+.05,k);if(g<=0||F<=0)return;const P=F<A?1-F*(1-R)/(A-E.r):E.h-(1-E.h)*Math.max(F-(A+E.r),0)/(A+E.r)-.02;L=Math.min(L,P+(1-g)*.5)});const w=Math.min(L,T),p=(a*o+h)*4;i[p]=Math.round(Math.min(f,1)*255),i[p+1]=Math.round(y*255),i[p+2]=Math.round(Math.min(1,Math.max(0,w/Qe))*255),i[p+3]=255}return i}function wo(e,t,o){const r=e.createTexture();return e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),rr(e,r,t,o),r}function rr(e,t,o,r){e.bindTexture(e.TEXTURE_2D,t),e.pixelStorei(e.UNPACK_ALIGNMENT,1),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,o.nx,o.nz,0,e.RGBA,e.UNSIGNED_BYTE,xo(o,r))}function yo(e,t,o){const r=e.createTexture();e.bindTexture(e.TEXTURE_3D,r),e.texStorage3D(e.TEXTURE_3D,1,e.RGBA8,o,o,o),e.texParameteri(e.TEXTURE_3D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_3D,e.TEXTURE_MAG_FILTER,e.LINEAR);for(const a of[e.TEXTURE_WRAP_S,e.TEXTURE_WRAP_T,e.TEXTURE_WRAP_R])e.texParameteri(e.TEXTURE_3D,a,e.REPEAT);const i=e.createFramebuffer();e.bindFramebuffer(e.FRAMEBUFFER,i),e.useProgram(t.p),e.uniform1f(t.u.uSize,o),e.viewport(0,0,o,o);for(let a=0;a<o;a++)e.framebufferTextureLayer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,r,0,a),e.uniform1f(t.u.uLayer,a),e.drawArrays(e.TRIANGLES,0,3);return e.bindFramebuffer(e.FRAMEBUFFER,null),e.deleteFramebuffer(i),r}function st(e,t,o,r){const i=e.createTexture();e.bindTexture(e.TEXTURE_2D,i),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA16F,t,o,0,e.RGBA,e.HALF_FLOAT,null);const a=e.createFramebuffer();if(e.bindFramebuffer(e.FRAMEBUFFER,a),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,i,0),e.checkFramebufferStatus(e.FRAMEBUFFER)!==e.FRAMEBUFFER_COMPLETE)throw new Error("fog: float target incomplete");return{tex:i,fb:a,w:t,h:o}}function Ue(e,t){e.deleteTexture(t.tex),e.deleteFramebuffer(t.fb)}function Q(e,t,o){const{p:r,v:i,f:a}=t;if(!e.getProgramParameter(r,e.LINK_STATUS)){const s=[i,a].map(u=>e.getShaderParameter(u,e.COMPILE_STATUS)?"":e.getShaderInfoLog(u)).find(Boolean);throw new Error(s||e.getProgramInfoLog(r)||"link failed")}e.deleteShader(i),e.deleteShader(a);const h={uTexel:e.getUniformLocation(r,"uTexel")};for(const s of o)h[s]=e.getUniformLocation(r,s);return{p:r,u:h}}function Xe(e,t,o){const r=Math.min(1,Math.max(0,(o-e)/(t-e)));return r*r*(3-2*r)}function go(e){const t=Math.hypot(e[0],e[1],e[2]);return[e[0]/t,e[1]/t,e[2]/t]}const dt=new Set;function or(e,t){const o={node:e,claim:t};return dt.add(o),()=>{dt.delete(o)}}function hn(e){if(e)for(const t of[...dt])e.contains(t.node)&&t.claim()}function nr(e,t){if(t.parentNode===e)return;const o=e.moveBefore;if(typeof o=="function"&&e.isConnected&&t.isConnected)try{o.call(e,t,null);return}catch{}e.appendChild(t)}const Bt="tm-flight",$t="tm-sequence",at=e=>!!e.closest(".tm-views[data-moving], .tm-view[data-pending], .tm-mist[data-seq-away]"),ce=[],Eo=2,Ot={density:1,depth:1,climb:1,drift:1,turbulence:1,light:1,pointer:1},bo=(e,t)=>`${e.room.w}x${e.room.h}:${t?"ambient":"interactive"}`,Se=new Map,se=new Map,pe=new Set;function To(e){for(let o=ce.length-1;o>=0;o--)ce[o].dead&&ce.splice(o,1);const t=ce.findIndex(o=>o.key===e);return t<0?null:ce.splice(t,1)[0]}function ir(e){var t;for(e.onFallback=null,e.fog.pause(),e.canvas.remove(),ce.push(e);ce.length>Eo;)(t=ce.shift())==null||t.fog.destroy();Lo()}const Ro=3e3;let Wt=0;function Lo(){window.clearTimeout(Wt),Wt=window.setTimeout(()=>{if(!([...Se.values()].some(e=>e.length)||pe.size))for(const e of ce.splice(0))e.fog.destroy()},Ro)}function Vt(e){const t=se.get(e.key);if(t===e)return;se.set(e.key,e);const o=(t==null?void 0:t.release())??To(e.key);o?e.attach(o):pe.has(e.key)||e.build()}function So(e){pe.delete(e.key);const t=se.get(e.key);t&&!t.mist?t.attach(e):ir(e)}function Mo(e){if(typeof window.requestIdleCallback=="function"){const o=window.requestIdleCallback(e,{timeout:600});return()=>window.cancelIdleCallback(o)}const t=window.setTimeout(e,120);return()=>window.clearTimeout(t)}function Ao({scene:e,still:t,ambient:o,zoom:r=1,tune:i,fallback:a=null}){const h=S.useRef(null),s=S.useRef(null),[u,f]=S.useState(null),y=S.useRef(t),T=S.useRef(r),L=S.useRef({...Ot,...i});return S.useEffect(()=>{var w;y.current=t,(w=s.current)==null||w.setStill(t)},[t]),S.useEffect(()=>{T.current=r},[r]),S.useEffect(()=>{var w;L.current={...Ot,...i},(w=s.current)==null||w.set(L.current)},[i]),S.useLayoutEffect(()=>{const w=h.current;if(!w||u)return;const p=bo(e,o);let E=!0,n=null;const d=M=>{E&&f(M)};let R=!1,A=0;const F=()=>{C.mist&&(at(w)||R?C.mist.fog.pause():C.mist.fog.resume())},k=M=>{if(n=null,!E||se.get(p)!==C||C.mist||pe.has(p))return;pe.add(p);const c=document.createElement("canvas");c.className="tm-floor-mist-canvas",c.setAttribute("aria-hidden","true");const b=M&&!y.current;b&&(c.style.opacity="0"),w.append(c);const D={canvas:c,fog:null,key:p,dead:!1,onFallback:null},B={scene:e,quality:o?"low":"high",interactive:!o,...L.current,still:y.current,zoom:T.current,onFallback:_=>{D.dead=!0,(D.onFallback??d)(_)}},z=_=>{if(!_){pe.delete(p),c.remove();return}D.fog=_,So(D),b&&(c.style.transition="opacity var(--tm-dur-scene) var(--tm-ease-breathe)",requestAnimationFrame(()=>requestAnimationFrame(()=>{c.style.opacity=""})))};M?co(c,B,()=>!E&&se.get(p)===void 0).then(z):z(ft(c,B))},C={key:p,node:w,mist:null,attach(M){C.mist=M,M.onFallback=d,s.current=M.fog;const c=M.canvas.parentNode!==w;nr(w,M.canvas),M.fog.setStill(y.current),M.fog.set(L.current),c&&M.fog.adopt(),M.fog.redraw(),F()},release(){const M=C.mist;return C.mist=null,s.current=null,M&&(M.onFallback=null),M},build(){at(w)||k(!1)}},g=()=>{if(C.mist)return F();se.get(p)===C&&!pe.has(p)&&!at(w)&&(n==null||n(),n=Mo(()=>k(!0)))},P=()=>{C.mist&&C.mist.fog.setZoom(T.current)},j=Se.get(p)??[];j.push(C),Se.set(p,j),se.has(p)||Vt(C);const N=or(w,()=>Vt(C));window.addEventListener(Bt,g),window.addEventListener($t,g),window.addEventListener("resize",P);const W=()=>{R||(R=!0,F()),window.clearTimeout(A),A=window.setTimeout(()=>{R=!1,F()},180)};return o&&window.addEventListener("scroll",W,{passive:!0}),()=>{if(E=!1,N(),window.removeEventListener(Bt,g),window.removeEventListener($t,g),window.removeEventListener("resize",P),window.removeEventListener("scroll",W),window.clearTimeout(A),n==null||n(),Se.set(p,(Se.get(p)??[]).filter(D=>D!==C)),se.get(p)!==C)return;se.delete(p);const M=C.release(),c=Se.get(p)??[],b=c[c.length-1];b?(se.set(p,b),M&&!M.dead?b.attach(M):pe.has(p)||b.build()):M&&!M.dead?ir(M):M&&M.canvas.remove()}},[e,o,u]),S.useEffect(()=>{if(o||t||u)return;const w=n=>{var d;n.pointerType!=="touch"&&((d=s.current)==null||d.setPointer(n.clientX,n.clientY))},p=()=>{var n;return(n=s.current)==null?void 0:n.releasePointer()},E=document.documentElement;return window.addEventListener("pointermove",w,{passive:!0}),E.addEventListener("pointerleave",p,{passive:!0}),window.addEventListener("blur",p),()=>{window.removeEventListener("pointermove",w),E.removeEventListener("pointerleave",p),window.removeEventListener("blur",p)}},[o,t,u]),u?m.jsx(m.Fragment,{children:a}):m.jsx("div",{ref:h,className:"tm-floor-mist",style:{"--tm-floor-mist-top":Yt(e)},"data-fog-scene":`${e.room.w}x${e.room.h}`,"aria-hidden":"true"})}const Ke={wide:{poster:"media/open-crisp.jpg",large:{poster:"media/open-crisp-4k.jpg"}},tall:{poster:"media/open-phone-crisp.jpg",large:{poster:"media/open-phone-crisp-4k.jpg"}}},pn="(max-width: 560px) and (max-aspect-ratio: 11/10)",mt=e=>Ie(`media/${e}`),sr={w:2560,h:1430,poster:Ie(Ke.wide.poster),large:{poster:Ie(Ke.wide.large.poster),from:2400}},Fo={w:1080,h:1934,poster:Ie(Ke.tall.poster),large:{poster:Ie(Ke.tall.large.poster),from:1100}},qt={x0:.08,x1:.92,focusY:.88};function vn(e,t,o){const r=e===sr?(qt.x1-qt.x0)*e.w:e.w;return Math.max(t/r,o/e.h)}function ar(e){return{video:e.video,poster:e.poster}}const _e=24,Co=()=>typeof window.matchMedia=="function"&&window.matchMedia("(pointer: coarse)").matches&&Math.min(window.screen.width,window.screen.height)<700;function ur(e){if(!e.large||typeof window>"u"||typeof navigator>"u"||window.innerWidth*(window.devicePixelRatio||1)<e.large.from)return"never";const t=navigator.connection;return t!=null&&t.saveData||typeof window.matchMedia=="function"&&window.matchMedia("(prefers-reduced-data: reduce)").matches||t!=null&&t.effectiveType&&t.effectiveType!=="4g"?"never":!(t!=null&&t.effectiveType)||Co()?"room":"now"}mt("night.mp4"),mt("night.jpg");const xn=[{x:.2424,y:.71,h:.1792},{x:.3682,y:.6452,h:.1792},{x:.4978,y:.5986,h:.1792},{x:.6296,y:.6558,h:.1792},{x:.7576,y:.7268,h:.1792}],wn=[{x:.168,y:.6083,h:.1417},{x:.4963,y:.5714,h:.1417},{x:.8306,y:.6166,h:.1417}],No="linear-gradient(transparent, transparent)",ht=578/1112,zo=e=>`url("${new URL(e,document.baseURI).href}")`;function Xt(e,t,o,r){const i=Math.max(e/((r.x1-r.x0)*o.w),t/o.h),a=o.w*i,h=o.h*i;return{left:e/2-(r.x0+r.x1)/2*a,top:(t-h)*r.focusY,width:a,height:h}}function ut(e,t,o,r,i,a,h,s){if(!i.w)return{box:e,minStage:0};const u=(p,E)=>{const n=e.left+p.x*e.width,d=p.h*e.height*ht/2;return n+d>=E.left&&n-d<=E.right};let f=-1/0,y=0;for(const p of t)for(const E of o){if(!E.bottom||!u(p,E))continue;const n=p.y-p.h;f=Math.max(f,E.bottom+a-n*e.height),y=Math.max(y,(E.bottom+a)/n)}const T=Math.min(0,Math.max(i.h-e.height,Math.max(e.top,f)));let L=f>-1/0&&y>h+.5?Math.ceil(y):0;const w=a/2;for(const p of t)for(const E of r){if(!E.top||!u(p,E))continue;const n=i.h-E.top,d=p.y*e.height,R=(e.height*(p.y-s)+w+n)/(1-s),A=f+d+w+n,F=(R-e.height)*s;L=Math.max(L,Math.ceil(f>F?A:R))}return{box:{...e,top:T},minStage:(L>i.h+.5||L>h+.5,L)}}function yn({room:e,seats:t,tall:o,sw:r,screen:i,wall:a,floor:h,clearance:s,footRoom:u,margin:f,band:y,focusY:T,minVial:L,plateScale:w=1,drift:p={x:0,y:0}}){const E={box:{left:0,top:0,width:0,height:0},stage:i,fill:!1,minStage:0};if(!r||!i)return E;const n=N=>N.h*(e.h/e.w)*ht/2;if(o){let N=1/0;for(const _ of t){const K=_.x-n(_),J=_.x+n(_);K<.5&&(N=Math.min(N,(r/2-f-p.x)/((.5-K)*w))),J>.5&&(N=Math.min(N,(r/2-f-p.x)/((J-.5)*w)))}const W=Math.min(Math.max(r/e.w,i/e.h),N/e.w),M=e.w*W,c=e.h*W,b=Math.min(i,c),D={left:(r-M)/2,top:(b-c)*T,width:M,height:c},B=ut(D,t,a,h.map(_=>({..._,top:b-_.top,bottom:b-_.bottom})),{w:r,h:b},s,c,T),z=Math.max(b,B.minStage);return{box:B.box,stage:z,fill:z>c+.5,minStage:z>b+.5?z:0}}const d=(y.x1-y.x0)*e.w,R=Math.max(r/d,i/e.h),A=N=>{const W=e.w*N,M=e.h*N,c=r/2-(y.x0+y.x1)/2*W;let b=-1/0,D=1/0;const B=w;for(const K of t){const J=K.h*M*B,Be=M/2+(K.y-.5)*M*B,ye=r/2+(c+K.x*W-r/2)*B,re=J*ht/2;if(ye-re<f+p.x||ye+re>r-f-p.x)return null;for(const fe of a)!fe.bottom||ye+re<fe.left||ye-re>fe.right||(b=Math.max(b,fe.bottom+s+p.y-(Be-J)));D=Math.min(D,i-p.y-Math.max(u,f+.11*J+36)-Be)}if(b>D)return null;const z=(i-M)*T;let _=Math.min(D,Math.max(b,z));if(M>=i){const K=Math.max(b,i-M),J=Math.min(D,0);K<=J&&(_=Math.min(J,Math.max(K,z)))}return _};let F=R,k=A(F);if(k===null){const N=L/(Math.max(...t.map(c=>c.h))*e.h);if(A(N)===null){let c=i;for(let D=0;D<6;D++){const B=ut(Xt(r,c,e,y),t,a,[{left:0,right:r,top:c-u,bottom:c}],{w:r,h:c},s,r/d*e.h,T);if(B.minStage<=c+.5)return{box:B.box,stage:c,fill:!1,minStage:c>i?c:0};c=B.minStage}return{box:ut(Xt(r,c,e,y),t,a,[{left:0,right:r,top:c-u,bottom:c}],{w:r,h:c},s,r/d*e.h,T).box,stage:c,fill:!1,minStage:c}}let W=N,M=R;for(let c=0;c<24;c++){const b=(W+M)/2;A(b)===null?M=b:W=b}F=W,k=A(F)??0}const C=e.w*F,g=e.h*F,P=r/2-(y.x0+y.x1)/2*C,j=P>.5||P+C<r-.5||k>.5||k+g<i-.5;return{box:{left:P,top:k,width:C,height:g},stage:i,fill:j,minStage:0}}function gn(e){const[t,o]=S.useState({w:0,h:0});return S.useLayoutEffect(()=>{const r=e.current;if(!r)return;const i=()=>o({w:r.clientWidth,h:r.clientHeight});i();const a=new ResizeObserver(i);return a.observe(r),()=>a.disconnect()},[e]),t}const Me=e=>!!e.closest(".tm-views[data-moving], .tm-view[data-parked], .tm-mist[data-seq-away]"),Ze=()=>!!document.querySelector(".tm-views[data-moving], .tm-view[data-pending]"),ve="tm-flight",Ye="tm-sequence";function En(e,t){S.useEffect(()=>{const o=e.current;if(!o)return;const r=()=>{Me(o)||(o.style.setProperty("--mx","0"),o.style.setProperty("--my","0"))};if(!t){r();return}let i=0;const a=h=>{h.pointerType==="touch"||i||Me(o)||(i=requestAnimationFrame(()=>{if(i=0,Me(o))return;const s=o.getBoundingClientRect();o.style.setProperty("--mx",((h.clientX-s.left)/s.width*2-1).toFixed(3)),o.style.setProperty("--my",((h.clientY-s.top)/s.height*2-1).toFixed(3))}))};return o.addEventListener("pointermove",a),o.addEventListener("pointerleave",r),()=>{o.removeEventListener("pointermove",a),o.removeEventListener("pointerleave",r),cancelAnimationFrame(i)}},[e,t])}const Po="100% 0px",cr="160px 0px";function Do({room:e,still:t,eager:o=!1,className:r="tm-room"}){const i=S.useRef(null),[a,h]=S.useState(o);return S.useEffect(()=>{const s=i.current;if(!s||a)return;const u=new IntersectionObserver(([f])=>{f.isIntersecting&&h(!0)},{rootMargin:Po});return u.observe(s),()=>u.disconnect()},[a,t]),S.useEffect(()=>{const s=i.current;return()=>{s!=null&&s.getAttribute("src")&&(s.pause(),s.removeAttribute("src"),s.load())}},[t]),S.useEffect(()=>{const s=i.current;if(!s||!a)return;let u=!1;const f=()=>{u&&!document.hidden&&!Me(s)?s.play().catch(()=>{}):s.pause()},y=new IntersectionObserver(([T])=>{u=T.isIntersecting,f()},{rootMargin:cr});return y.observe(s),document.addEventListener("visibilitychange",f),window.addEventListener(ve,f),window.addEventListener(Ye,f),()=>{y.disconnect(),document.removeEventListener("visibilitychange",f),window.removeEventListener(ve,f),window.removeEventListener(Ye,f)}},[e.video,t,a]),t?m.jsx("img",{className:r,src:e.poster,alt:"","aria-hidden":"true",draggable:!1,loading:o?void 0:"lazy"}):m.jsx("video",{ref:i,className:r,src:a?e.video:void 0,poster:a&&e.poster?e.poster:void 0,muted:!0,loop:!0,playsInline:!0,preload:a?"auto":"none","aria-hidden":"true"})}const je=new Map;function Uo(e){let t=je.get(e.poster);if(!t){const o=document.createElement("video");o.className="tm-room",o.muted=!0,o.defaultMuted=!0,o.loop=!0,o.playsInline=!0,o.setAttribute("muted",""),o.setAttribute("playsinline",""),o.setAttribute("aria-hidden","true"),o.preload="auto";const r=ar(e);o.poster=r.poster,o.src=r.video??"",t={room:e,video:o,owner:null,hosts:[],cut:"light"},je.set(e.poster,t);const i=ur(e);i==="now"?(t.cut="waiting",fr(t)):i==="room"&&(t.cut="in-room")}return t}const lr=e=>!e.node.closest(".tm-mist");function _o(e,t){e.cut!=="in-room"||!lr(t)||(e.cut="waiting",fr(e))}function pt(e){const t=()=>{typeof window.requestIdleCallback=="function"?window.requestIdleCallback(e,{timeout:4e3}):window.setTimeout(e,1500)};document.readyState==="complete"?t():window.addEventListener("load",t,{once:!0})}function Ge(e){if(!Ze())return e();const t=()=>{Ze()||(window.removeEventListener(ve,t),e())};window.addEventListener(ve,t)}function fr(e){const t=e.room.large;if(!(t!=null&&t.video))return;const o=t.video;let r=0;const i=()=>Ge(()=>pt(()=>Ge(a))),a=()=>{if(e.cut!=="waiting"||!e.owner||r>=3)return;r++,e.cut="readying";const h=e.owner,s=e.video,u=document.createElement("video");u.className="tm-room",u.muted=!0,u.defaultMuted=!0,u.loop=!0,u.playsInline=!0,u.setAttribute("muted",""),u.setAttribute("playsinline",""),u.setAttribute("aria-hidden","true"),u.preload="auto",u.poster=s.poster,u.src=o,h.node.insertBefore(u,s);let f=!1;const y=g=>{var j;if(f)return;if(f=!0,window.removeEventListener(ve,T),window.clearTimeout(L),!g||e.owner!==h||e.video!==s||Ze()){u.pause(),u.removeAttribute("src"),u.load(),u.remove(),e.cut="waiting",i();return}const P=!s.paused;(j=h.unwire)==null||j.call(h),e.video=u,s.remove(),P&&u.play().catch(()=>{}),h.unwire=dr(h.node,u),s.pause(),s.removeAttribute("src"),s.load(),e.cut="large",window.dispatchEvent(new CustomEvent("tm-room-cut",{detail:{room:e.room.video,cut:o,frame:R,playing:P}}))},T=()=>{Ze()&&y(!1)};window.addEventListener(ve,T);const L=window.setTimeout(()=>y(!1),2e4),w=()=>Math.max(1,Math.round((s.duration||1)*_e)),p=g=>Math.round(g*_e)%w(),E=(g,P)=>{const j=w(),N=((g-P)%j+j)%j;return N>j/2?N-j:N},n=typeof s.requestVideoFrameCallback=="function";let d=12,R=-1,A=!1;const F=()=>{f||(A=!1,R=(p(s.currentTime)+d)%w(),u.pause(),u.currentTime=(R+.5)/_e,u.addEventListener("seeked",()=>{var j;const g=R,P=()=>{!f&&g===R&&(A=!0)};n?(j=u.requestVideoFrameCallback)==null||j.call(u,P):requestAnimationFrame(P)},{once:!0}))},k=g=>{if(f||R<0)return;const P=E(g,R);P===0&&A?requestAnimationFrame(()=>{f||y(!0)}):P>=0&&(d=Math.min(48,d*2),F())},C=()=>{var g;if(!f){if(s.paused&&s.played.length===0&&s.currentTime===0){R=0,requestAnimationFrame(()=>y(!0));return}if(s.paused){R=p(s.currentTime),u.currentTime=s.currentTime,u.addEventListener("seeked",()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{f||(s.paused&&Math.abs(u.currentTime-s.currentTime)<.25/_e?y(!0):C())})),{once:!0});return}if(F(),n){const P=(j,N)=>{var W;f||(k(p(N.mediaTime)),(W=s.requestVideoFrameCallback)==null||W.call(s,P))};(g=s.requestVideoFrameCallback)==null||g.call(s,P)}else{let P=-1;const j=()=>{if(f)return;const N=Math.floor(s.currentTime*_e)%w();N!==P&&(P=N,k(N)),requestAnimationFrame(j)};requestAnimationFrame(j)}}};u.readyState>=4?C():u.addEventListener("canplaythrough",C,{once:!0})};pt(()=>Ge(a))}function dr(e,t){let o=!1;const r=()=>{o&&!document.hidden&&!Me(e)?t.play().catch(()=>{}):t.pause()},i=new IntersectionObserver(([a])=>{o=a.isIntersecting,r()},{rootMargin:cr});return i.observe(e),document.addEventListener("visibilitychange",r),window.addEventListener(ve,r),window.addEventListener(Ye,r),Me(e)&&t.pause(),()=>{i.disconnect(),document.removeEventListener("visibilitychange",r),window.removeEventListener(ve,r),window.removeEventListener(Ye,r)}}const ke=new Map;function jo(e){let t=ke.get(e.poster);if(!t){t={room:e,hosts:[],cut:"light"},ke.set(e.poster,t);const o=ur(e),r=t;o==="now"?pt(()=>hr(r)):o==="room"&&(t.cut="in-room")}return t}function mr(e,t){const o=e.room.large;if(!o||t.img)return;const r=document.createElement("img");r.className="tm-room",r.alt="",r.setAttribute("aria-hidden","true"),r.draggable=!1,r.src=o.poster,t.img=r,t.node.append(r)}function hr(e){const t=e.room.large;if(!t||e.cut==="readying"||e.cut==="large")return;e.cut="readying";const o=new Image;o.src=t.poster,o.decode().then(()=>Ge(()=>requestAnimationFrame(()=>{if(ke.get(e.room.poster)===e){e.cut="large";for(const r of e.hosts)mr(e,r);window.dispatchEvent(new CustomEvent("tm-room-cut",{detail:{room:e.room.poster,cut:t.poster}}))}})),()=>{e.cut="light"})}function Io(e,t){e.cut==="large"?mr(e,t):e.cut==="in-room"&&lr(t)&&hr(e)}const ko=3e3;let Gt=0;function Ht(){window.clearTimeout(Gt),Gt=window.setTimeout(()=>{if(![...je.values(),...ke.values()].some(e=>e.hosts.length)){for(const e of je.values())e.video.pause(),e.video.removeAttribute("src"),e.video.removeAttribute("poster"),e.video.load();je.clear(),ke.clear()}},ko)}function ct(e,t){var o,r;e.owner!==t&&(e.owner&&((r=(o=e.owner).unwire)==null||r.call(o),e.owner.unwire=null),e.owner=t,nr(t.node,e.video),t.unwire=dr(t.node,e.video),_o(e,t))}function bn({room:e,still:t}){const o=S.useRef(null),r=!!e.video;return S.useLayoutEffect(()=>{const i=o.current;if(t&&r||!i||typeof document.createElement!="function")return;if(!r){const u=jo(e),f={node:i,unwire:null,img:null};return u.hosts.push(f),Io(u,f),()=>{var y;(y=f.img)==null||y.remove(),u.hosts=u.hosts.filter(T=>T!==f),u.hosts.length||Ht()}}const a=Uo(e),h={node:i,unwire:null};a.hosts.push(h),a.owner||ct(a,h);const s=or(i,()=>ct(a,h));return()=>{var f;if(s(),a.hosts=a.hosts.filter(y=>y!==h),a.owner!==h)return;(f=h.unwire)==null||f.call(h),a.owner=null;const u=a.hosts[a.hosts.length-1];u?ct(a,u):(a.video.pause(),a.video.remove(),Ht())}},[e,t,r]),t&&r?m.jsx("img",{className:"tm-room",src:ar(e).poster,alt:"","aria-hidden":"true",draggable:!1}):m.jsx("div",{className:"tm-room tm-room-loop",ref:o,"aria-hidden":"true"})}const pr=e=>e===sr?lt.collection:e===Fo?lt.collectionTall:void 0;function Tn({room:e,pedestal:t,blur:o}){const r=pr(e),i=r&&t!==null?Kr(r,t):null,a=i&&o>0?{"--tm-focus-mask":i,"--tm-focus-blur":`${o.toFixed(3)}px`}:void 0;return m.jsx("div",{className:"tm-room-focus",style:a,"data-focus":a?"":void 0,"aria-hidden":"true"})}function Rn({box:e,children:t}){return m.jsx("div",{className:"tm-room-plate",style:e,children:t})}function Ln({product:e,seat:t,night:o=!1,lit:r=1,to:i,delay:a=0,soft:h,shade:s,onOpen:u,onNear:f}){const y=`${e.name}, ${e.size}`,T=Mt(e,"lg"),L=S.useRef(null),[w,p]=S.useState(null);S.useLayoutEffect(()=>{const d=L.current;if(!d)return;const R=()=>{d.naturalWidth&&p(d.currentSrc||d.src)};return d.complete&&R(),d.addEventListener("load",R),()=>d.removeEventListener("load",R)},[T]);const E={"--tm-glass-mask":w?zo(w):No,"--seat-x":t.x,"--seat-y":t.y,"--vial-h":t.h,"--tm-i":a,"--tm-lit":r},n=m.jsxs(m.Fragment,{children:[o&&m.jsx("img",{className:"tm-room-vial-reflect",src:T,alt:"","aria-hidden":"true",draggable:!1}),s?m.jsx("img",{className:"tm-room-vial-shade",src:s,alt:"","aria-hidden":"true",draggable:!1,decoding:"async"}):m.jsxs(m.Fragment,{children:[m.jsx("span",{className:"tm-room-vial-shadow","aria-hidden":"true"}),!o&&m.jsx("span",{className:"tm-room-vial-cast","aria-hidden":"true"})]}),m.jsx("img",{ref:L,className:"tm-room-vial-glass",src:T,srcSet:`${Mt(e,"sm")} 289w, ${T} 578w`,sizes:"(max-width: 760px) 30vw, 18vw",alt:i?"":y,draggable:!1,loading:o?"lazy":void 0}),h&&m.jsx("img",{className:"tm-room-vial-soft",src:h,alt:"","aria-hidden":"true",draggable:!1,decoding:"async"}),m.jsx("span",{className:o?"tm-room-vial-beam":"tm-room-vial-air","aria-hidden":"true"})]});return i?m.jsx(Kt,{className:"tm-room-vial",to:i,style:E,"data-product-id":e.id,"aria-label":y,onClick:u,onPointerEnter:()=>f==null?void 0:f(),onFocus:()=>f==null?void 0:f(),children:n}):m.jsx("figure",{className:"tm-room-vial",style:E,"data-night":o?"":void 0,children:n})}function Sn({still:e,room:t,zoom:o=1,tune:r}){const i=Nt("(max-width: 760px)"),a=Nt("(pointer: coarse)"),h=e||i?null:m.jsx(Do,{room:{w:1920,h:1080,video:mt("fog.mp4"),poster:""},still:!1,className:"tm-front-mist"}),s=t?pr(t):void 0;return s?m.jsx(Ao,{scene:s,still:e,ambient:i||a,zoom:o,tune:r,fallback:h}):h}export{Jo as A,ot as B,fn as C,Pt as D,hn as E,Sn as F,_r as G,tn as H,Or as I,dn as L,qt as O,Rn as P,bn as R,ln as S,pn as T,ht as V,an as a,sn as b,un as c,cn as d,en as e,Dt as f,Br as g,Kr as h,pr as i,zo as j,gn as k,yn as l,wn as m,xn as n,En as o,ar as p,Fo as q,rn as r,sr as s,Tn as t,on as u,nn as v,Ln as w,mn as x,lt as y,vn as z};
