const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'assets', 'avatar_frames');

// ── Helpers ──
function base(nm, layers) {
  return { v:"5.6.5", fr:30, ip:0, op:120, w:500, h:500, nm, ddd:0, assets:[], layers };
}
function layer(nm, shapes, ind, ksOverrides={}) {
  return {
    ddd:0, ind, ty:4, nm, sr:1,
    ks: { o:{a:0,k:100}, r:{a:0,k:0}, p:{a:0,k:[250,250,0]}, a:{a:0,k:[0,0,0]}, s:{a:0,k:[100,100,100]}, ...ksOverrides },
    ao:0, shapes, ip:0, op:120, st:0, bm:0
  };
}
function el(sx,sy) { return {d:1,ty:"el",s:{a:0,k:[sx,sy]},p:{a:0,k:[0,0]}}; }
function poly(pts,r,rnd=0) { return {ty:"sr",sy:2,d:1,pt:{a:0,k:pts},p:{a:0,k:[0,0]},r:{a:0,k:0},or:{a:0,k:r},os:{a:0,k:rnd}}; }
function star(pts,or,ir) { return {ty:"sr",sy:1,d:1,pt:{a:0,k:pts},p:{a:0,k:[0,0]},r:{a:0,k:0},or:{a:0,k:or},os:{a:0,k:0},ir:{a:0,k:ir},is:{a:0,k:0}}; }
function rect(w,h) { return {ty:"rc",d:1,s:{a:0,k:[w,h]},p:{a:0,k:[0,0]},r:{a:0,k:0}}; }
function st(r,g,b,w,op=100) { return {ty:"st",c:{a:0,k:[r,g,b,1]},o:{a:0,k:op},w:{a:0,k:w},lc:2,lj:2,bm:0}; }
function fl(r,g,b,op=100) { return {ty:"fl",c:{a:0,k:[r,g,b,1]},o:{a:0,k:op},r:1,bm:0}; }
function gs(stops,w,rF,rT) {
  const k=[]; stops.forEach((s,i)=>k.push(i/(stops.length-1),s[0],s[1],s[2]));
  return {ty:"gs",o:{a:0,k:100},w:{a:0,k:w},g:{p:stops.length,k:{a:0,k}},
    s:{a:0,k:[0,0]},e:{a:0,k:[500,0]},t:1,h:{a:0,k:0},
    a:{a:1,k:[{i:{x:[.833],y:[.833]},o:{x:[.167],y:[.167]},t:0,s:[rF]},{t:120,s:[rT]}]},lc:2,lj:2};
}
function tr(px=0,py=0,sx=100,sy=100,r=0,op=100) {
  return {ty:"tr",p:{a:0,k:[px,py]},a:{a:0,k:[0,0]},s:{a:0,k:[sx,sy]},
    r:{a:0,k:r},o:{a:0,k:op},sk:{a:0,k:0},sa:{a:0,k:0}};
}
function trAnimR(px,py,rF,rT,op=100) {
  return {ty:"tr",p:{a:0,k:[px,py]},a:{a:0,k:[0,0]},s:{a:0,k:[100,100]},
    r:{a:1,k:[{i:{x:[.833],y:[.833]},o:{x:[.167],y:[.167]},t:0,s:[rF]},{t:120,s:[rT]}]},
    o:{a:0,k:op},sk:{a:0,k:0},sa:{a:0,k:0}};
}
function animScale(f,t) {
  return {a:1,k:[{i:{x:[.833,.833]},o:{x:[.167,.167]},t:0,s:[f,f]},{t:120,s:[t,t]}]};
}
function animOp(vals,times) {
  const k=[];
  for(let i=0;i<vals.length-1;i++) k.push({i:{x:[.833],y:[.833]},o:{x:[.167],y:[.167]},t:times[i],s:[vals[i]]});
  k.push({t:times[times.length-1],s:[vals[vals.length-1]]});
  return {a:1,k};
}
function tm(s,e,oF,oT) {
  return {ty:"tm",s:{a:0,k:s},e:{a:0,k:e},
    o:{a:1,k:[{i:{x:[.833],y:[.833]},o:{x:[.167],y:[.167]},t:0,s:[oF]},{t:120,s:[oT]}]},m:1};
}
function grp(nm,items) { return {ty:"gr",it:items,nm}; }

// ════════════════════════════════════════════════════════════════
// 1. CelestialOrbit — 3D gyroscope: 3 intersecting orbital rings
// ════════════════════════════════════════════════════════════════
function makeCelestialOrbit() {
  const L = [];
  // Sparkle dots (6 orbiting)
  const dots = [];
  for(let i=0;i<6;i++) {
    dots.push(grp("d"+i,[
      el(12,12), fl(1,0.95,0.7,90),
      trAnimR(Math.cos(i*Math.PI/3)*210, Math.sin(i*Math.PI/3)*70, i*60, i*60+360, 80)
    ]));
  }
  L.push(layer("Dots",dots,0));

  // Tilted Ring C — flattened, rotated -50°
  L.push(layer("OrbitC",[grp("oc",[
    el(440,140), st(.96,.75,.2,6), gs([[.96,.85,.2],[1,.95,.6],[.96,.75,.2]],5,0,360),
    tr(0,0,100,100,-50,55)
  ])],1));

  // Tilted Ring B — flattened, rotated 50°
  L.push(layer("OrbitB",[grp("ob",[
    el(440,140), st(.85,.4,.7,6), gs([[.85,.4,.7],[1,.7,.9],[.85,.4,.7]],5,0,-360),
    tr(0,0,100,100,50,55)
  ])],2));

  // Main Ring — full circle
  L.push(layer("MainRing",[grp("mr",[
    el(450,450), st(.2,.88,.9,19),
    gs([[.15,.75,.8],[.3,.95,.95],[.6,1,1],[.3,.95,.95],[.15,.75,.8]],18,0,360),
    tr()
  ])],3));

  // Outer glow
  L.push(layer("Glow",[grp("gl",[
    el(468,468), st(.2,.88,.9,26,35),
    gs([[.1,.6,.65],[.3,.95,.95],[.1,.6,.65]],24,0,180),
    tr()
  ])],4));

  // Shimmer
  L.push(layer("Shim",[grp("sh",[
    el(450,450), gs([[1,1,1],[.7,1,1],[1,1,1]],10,0,720), tm(0,15,0,360),
    tr(0,0,100,100,0,70)
  ])],5));

  return base("CelestialOrbit",L);
}

// ════════════════════════════════════════════════════════════════
// 2. HexPrism — Hexagonal frame with prismatic rainbow gradient
// ════════════════════════════════════════════════════════════════
function makeHexPrism() {
  const L = [];
  // Vertex sparkles (6 corners)
  const sparks = [];
  for(let i=0;i<6;i++) {
    const a = i*Math.PI/3 - Math.PI/6;
    sparks.push(grp("sp"+i,[
      el(10,10), fl(1,1,1,80),
      {ty:"tr",p:{a:0,k:[Math.cos(a)*220, Math.sin(a)*220]},a:{a:0,k:[0,0]},
       s:animScale(60,120),r:{a:0,k:0},
       o:animOp([30,100,30],[0,30+i*15,60+i*15]),sk:{a:0,k:0},sa:{a:0,k:0}}
    ]));
  }
  L.push(layer("Sparks",sparks,0));

  // Inner hex highlight
  L.push(layer("InnerHex",[grp("ih",[
    poly(6,200,30), st(1,1,1,2,40), tr()
  ])],1));

  // Main hex — rainbow gradient
  L.push(layer("MainHex",[grp("mh",[
    poly(6,225,20),
    st(.6,.2,.9,19), // solid backup
    gs([[1,.2,.3],[1,.7,.2],[.2,1,.4],[.2,.8,1],[.5,.2,1],[1,.2,.6],[1,.2,.3]],18,0,360),
    tr()
  ])],2));

  // Outer hex glow
  L.push(layer("GlowHex",[grp("gh",[
    poly(6,238,25), st(.6,.3,.9,24,35), tr()
  ])],3));

  // Rotating inner pattern
  L.push(layer("InnerSpin",[grp("is",[
    poly(6,180,15),
    gs([[1,.8,.2],[.2,1,.8],[.8,.2,1],[1,.8,.2]],4,0,720),
    trAnimR(0,0,0,360,30)
  ])],4));

  return base("HexPrism",L);
}

// ════════════════════════════════════════════════════════════════
// 3. PulseWave — Radar/sonar expanding pulse rings
// ════════════════════════════════════════════════════════════════
function makePulseWave() {
  const L = [];
  function pulseRing(nm,ind,delay) {
    const dur = 120;
    const t0 = delay, t1 = delay+10, t2 = delay+90, t3 = Math.min(delay+100,119);
    return layer(nm,[grp(nm,[
      el(440,440), st(0,.95,.8,12),
      {ty:"tr",p:{a:0,k:[0,0]},a:{a:0,k:[0,0]},
       s:{a:1,k:[
         {i:{x:[.5,.5]},o:{x:[.5,.5]},t:t0%dur,s:[90,90]},
         {t:t3%dur,s:[115,115]}
       ]},
       r:{a:0,k:0},
       o:{a:1,k:[
         {i:{x:[.833]},o:{x:[.167]},t:t0%dur,s:[80]},
         {i:{x:[.833]},o:{x:[.167]},t:t1%dur,s:[80]},
         {t:t3%dur,s:[0]}
       ]},
       sk:{a:0,k:0},sa:{a:0,k:0}}
    ])],ind);
  }
  L.push(pulseRing("P1",0,0));
  L.push(pulseRing("P2",1,40));
  L.push(pulseRing("P3",2,80));

  // Static base ring
  L.push(layer("Base",[grp("br",[
    el(440,440), st(0,.75,.7,19),
    gs([[0,.6,.65],[0,.95,.95],[.4,1,1],[0,.95,.95],[0,.6,.65]],18,0,180),
    tr()
  ])],3));

  // Center pulse glow
  L.push(layer("CenterGlow",[grp("cg",[
    el(400,400), fl(0,.9,.85,8), tr()
  ])],4));

  // Sparkles
  const sps = [];
  for(let i=0;i<4;i++) {
    const a = i*Math.PI/2+Math.PI/4;
    sps.push(grp("s"+i,[
      el(8,8), fl(0,1,.9,90),
      {ty:"tr",p:{a:0,k:[Math.cos(a)*228,Math.sin(a)*228]},a:{a:0,k:[0,0]},
       s:animScale(50,130),r:{a:0,k:0},
       o:animOp([40,100,40],[0,20+i*25,60+i*25]),sk:{a:0,k:0},sa:{a:0,k:0}}
    ]));
  }
  L.push(layer("Sparks",sps,5));

  return base("PulseWave",L);
}

// ════════════════════════════════════════════════════════════════
// 4. EclipseCorona — Dark ring with radiating corona rays
// ════════════════════════════════════════════════════════════════
function makeEclipseCorona() {
  const L = [];
  // Corona rays — 12 thin rectangles radiating outward
  const rays = [];
  for(let i=0;i<12;i++) {
    rays.push(grp("r"+i,[
      rect(3,40),
      fl(.6,.3,.9,60),
      {ty:"tr",p:{a:0,k:[0,-240]},a:{a:0,k:[0,0]},s:{a:0,k:[100,100]},
       r:{a:0,k:i*30},o:animOp([20,70,20],[0,10+i*8,40+i*8]),
       sk:{a:0,k:0},sa:{a:0,k:0}}
    ]));
  }
  L.push(layer("Rays",rays,0,{r:{a:1,k:[{i:{x:[.833],y:[.833]},o:{x:[.167],y:[.167]},t:0,s:[0]},{t:120,s:[30]}]}}));

  // Outer corona glow
  L.push(layer("CoronaGlow",[grp("cg",[
    el(475,475), st(.5,.15,.7,30,25),
    gs([[.3,.05,.5],[.6,.2,.85],[.8,.4,1],[.6,.2,.85],[.3,.05,.5]],28,0,120),
    tr()
  ])],1));

  // Main dark ring
  L.push(layer("DarkRing",[grp("dr",[
    el(445,445), st(.35,.1,.55,19),
    gs([[.2,.05,.35],[.5,.15,.7],[.7,.3,.9],[.5,.15,.7],[.2,.05,.35]],18,0,-180),
    tr()
  ])],2));

  // Inner edge highlight
  L.push(layer("InnerEdge",[grp("ie",[
    el(425,425), st(.8,.5,1,2,50), tr()
  ])],3));

  // Energy particles
  const eps = [];
  for(let i=0;i<5;i++) {
    const a = i*Math.PI*2/5;
    eps.push(grp("e"+i,[
      el(7,7), fl(.8,.5,1,85),
      {ty:"tr",p:{a:0,k:[Math.cos(a)*225,Math.sin(a)*225]},a:{a:0,k:[0,0]},
       s:animScale(40,120),r:{a:0,k:0},
       o:animOp([30,100,30],[0,15+i*20,50+i*20]),sk:{a:0,k:0},sa:{a:0,k:0}}
    ]));
  }
  L.push(layer("Particles",eps,4));

  // Shimmer
  L.push(layer("Shim",[grp("sh",[
    el(445,445), gs([[1,.8,1],[.8,.5,1],[1,.8,1]],8,0,720), tm(0,12,0,360),
    tr(0,0,100,100,0,60)
  ])],5));

  return base("EclipseCorona",L);
}

// ════════════════════════════════════════════════════════════════
// 5. GlitchMatrix — Cyberpunk glitch effect ring
// ════════════════════════════════════════════════════════════════
function makeGlitchMatrix() {
  const L = [];
  // Glitch offset ring A — shifts right
  L.push(layer("GlitchA",[grp("ga",[
    el(445,445), st(0,1,.7,10),
    {ty:"tr",
     p:{a:1,k:[
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:0,s:[0,0]},
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:15,s:[0,0]},
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:18,s:[6,0]},
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:22,s:[0,0]},
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:55,s:[0,0]},
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:58,s:[-5,2]},
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:62,s:[0,0]},
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:90,s:[0,0]},
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:93,s:[4,-3]},
       {t:97,s:[0,0]}
     ]},
     a:{a:0,k:[0,0]},s:{a:0,k:[100,100]},r:{a:0,k:0},
     o:{a:0,k:50},sk:{a:0,k:0},sa:{a:0,k:0}}
  ])],0));

  // Glitch offset ring B — shifts left, magenta
  L.push(layer("GlitchB",[grp("gb",[
    el(445,445), st(1,0,.5,10),
    {ty:"tr",
     p:{a:1,k:[
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:0,s:[0,0]},
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:15,s:[0,0]},
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:18,s:[-6,0]},
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:22,s:[0,0]},
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:55,s:[0,0]},
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:58,s:[5,-2]},
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:62,s:[0,0]},
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:90,s:[0,0]},
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:93,s:[-4,3]},
       {t:97,s:[0,0]}
     ]},
     a:{a:0,k:[0,0]},s:{a:0,k:[100,100]},r:{a:0,k:0},
     o:{a:0,k:50},sk:{a:0,k:0},sa:{a:0,k:0}}
  ])],1));

  // Scan line — horizontal bar sweeping up/down
  L.push(layer("Scan",[grp("sc",[
    rect(500,4), fl(0,1,.8,40),
    {ty:"tr",
     p:{a:1,k:[
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:0,s:[0,-240]},
       {i:{x:[.5,.5]},o:{x:[.5,.5]},t:60,s:[0,240]},
       {t:120,s:[0,-240]}
     ]},
     a:{a:0,k:[0,0]},s:{a:0,k:[100,100]},r:{a:0,k:0},o:{a:0,k:40},
     sk:{a:0,k:0},sa:{a:0,k:0}}
  ])],2));

  // Main ring — neon green
  L.push(layer("MainRing",[grp("mr",[
    el(445,445), st(0,.8,.6,19),
    gs([[0,.6,.4],[0,1,.7],[.4,1,.8],[0,1,.7],[0,.6,.4]],18,0,180),
    tr()
  ])],3));

  // Outer glow
  L.push(layer("Glow",[grp("gl",[
    el(468,468), st(0,.8,.6,24,30), tr()
  ])],4));

  // Data particles — small squares
  const dps = [];
  for(let i=0;i<6;i++) {
    const a = i*Math.PI/3;
    dps.push(grp("dp"+i,[
      rect(6,6), fl(0,1,.8,80),
      {ty:"tr",p:{a:0,k:[Math.cos(a)*225,Math.sin(a)*225]},a:{a:0,k:[0,0]},
       s:animScale(0,120),r:animScale(0,90).k ? {a:1,k:[{i:{x:[.833],y:[.833]},o:{x:[.167],y:[.167]},t:0,s:[0]},{t:120,s:[180]}]} : {a:0,k:0},
       o:animOp([0,100,0],[0,10+i*18,50+i*18]),sk:{a:0,k:0},sa:{a:0,k:0}}
    ]));
  }
  L.push(layer("Data",dps,5));

  return base("GlitchMatrix",L);
}

// ── Generate all ──
const frames = [
  ['CelestialOrbit', makeCelestialOrbit],
  ['HexPrism', makeHexPrism],
  ['PulseWave', makePulseWave],
  ['EclipseCorona', makeEclipseCorona],
  ['GlitchMatrix', makeGlitchMatrix],
];

for (const [name, fn] of frames) {
  const data = fn();
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(data));
  console.log(`✅ ${name}.json oluşturuldu`);
}
console.log('\n🎉 5 egzantrik çerçeve tamamlandı!');
