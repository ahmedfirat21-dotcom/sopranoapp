/**
 * TealRibbon Frame Generator — Toz parçacıkları + parlama animasyonlu
 * Teal-Cyan temalı avatar çerçevesi (Lottie JSON)
 */
const fs = require('fs');
const path = require('path');

const W = 500, H = 560, CX = 250, CY = 250, FR = 30, DUR = 150;
const TEAL = [0.078, 0.722, 0.651, 1];      // #14B8A6
const CYAN = [0.024, 0.714, 0.831, 1];       // #06B6D4
const TEAL_LIGHT = [0.451, 0.882, 0.82, 1];  // #73E1D1
const WHITE = [1, 1, 1, 1];
const TEAL_DARK = [0.051, 0.373, 0.408, 1];  // #0D5F68

// Helper: easing curves
const easeIn = { x: [0.667], y: [1] };
const easeOut = { x: [0.333], y: [0] };

function opacity_pulse(min, max, steps) {
  const k = [];
  for (let i = 0; i < steps; i++) {
    const t = Math.round((i / steps) * DUR);
    k.push({ i: easeIn, o: easeOut, t, s: [i % 2 === 0 ? min : max] });
  }
  k.push({ t: DUR, s: [min] });
  return { a: 1, k };
}

function rotate_loop(startDeg, endDeg) {
  return { a: 1, k: [
    { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [startDeg] },
    { t: DUR, s: [endDeg] }
  ]};
}

// ── Layer 1: Sparkle Dots (ON TOP of avatar) ──
function makeSparkles() {
  const dots = [];
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  const radii = [195, 200, 205, 198, 202, 197, 203, 199];
  angles.forEach((deg, i) => {
    const rad = (deg * Math.PI) / 180;
    const r = radii[i];
    const px = Math.round(Math.cos(rad) * r);
    const py = Math.round(Math.sin(rad) * r);
    const sz = 4 + (i % 3) * 2;
    const col = i % 3 === 0 ? WHITE : i % 3 === 1 ? TEAL_LIGHT : CYAN;
    dots.push({
      ty: "gr", it: [
        { d: 1, ty: "el", s: { a: 0, k: [sz, sz] }, p: { a: 0, k: [px, py] } },
        { ty: "fl", c: { a: 0, k: col }, o: { a: 0, k: 90 }, r: 1, bm: 0 },
        { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }
      ], nm: `sp${i}`, bm: 0
    });
  });
  return {
    ddd: 0, ind: 1, ty: 4, nm: "Sparkles", sr: 1,
    ks: {
      o: opacity_pulse(0, 95, 8),
      r: rotate_loop(0, 360),
      p: { a: 0, k: [CX, CY, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 1, k: [
        { i: { x: [0.667,0.667,0.667], y: [1,1,1] }, o: { x: [0.333,0.333,0.333], y: [0,0,0] }, t: 0, s: [95,95,100] },
        { i: { x: [0.667,0.667,0.667], y: [1,1,1] }, o: { x: [0.333,0.333,0.333], y: [0,0,0] }, t: 75, s: [108,108,100] },
        { t: DUR, s: [95,95,100] }
      ]}
    },
    ao: 0, shapes: dots, ip: 0, op: DUR, st: 0, bm: 0
  };
}

// ── Layer 2: Dust Particles (ON TOP - floating around ring) ──
function makeDust() {
  const particles = [];
  const count = 12;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 360;
    const rad = (angle * Math.PI) / 180;
    const r = 210 + (i % 4) * 8;
    const px = Math.round(Math.cos(rad) * r);
    const py = Math.round(Math.sin(rad) * r);
    const sz = 2 + (i % 3);
    const col = i % 4 === 0 ? WHITE : i % 4 === 1 ? TEAL_LIGHT : i % 4 === 2 ? CYAN : TEAL;
    const opa = 50 + (i % 4) * 12;
    particles.push({
      ty: "gr", it: [
        { d: 1, ty: "el", s: { a: 0, k: [sz, sz] }, p: { a: 0, k: [px, py] } },
        { ty: "fl", c: { a: 0, k: col }, o: { a: 0, k: opa }, r: 1, bm: 0 },
        { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }
      ], nm: `d${i}`, bm: 0
    });
  }
  return {
    ddd: 0, ind: 2, ty: 4, nm: "Dust", sr: 1,
    ks: {
      o: opacity_pulse(20, 80, 6),
      r: rotate_loop(0, -180),
      p: { a: 0, k: [CX, CY, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 1, k: [
        { i: { x: [0.667,0.667,0.667], y: [1,1,1] }, o: { x: [0.333,0.333,0.333], y: [0,0,0] }, t: 0, s: [100,100,100] },
        { i: { x: [0.667,0.667,0.667], y: [1,1,1] }, o: { x: [0.333,0.333,0.333], y: [0,0,0] }, t: 75, s: [112,112,100] },
        { t: DUR, s: [100,100,100] }
      ]}
    },
    ao: 0, shapes: particles, ip: 0, op: DUR, st: 0, bm: 0
  };
}

// ── Layer 3: Shimmer arc (ON TOP - rotating shine) ──
function makeShimmer() {
  return {
    ddd: 0, ind: 3, ty: 4, nm: "Shimmer", sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      p: { a: 0, k: [CX, CY, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] }
    },
    ao: 0,
    shapes: [{
      ty: "gr", it: [
        { d: 1, ty: "el", s: { a: 0, k: [440, 440] }, p: { a: 0, k: [0, 0] } },
        { ty: "gs", o: { a: 0, k: 85 }, w: { a: 0, k: 6 },
          g: { p: 3, k: { a: 0, k: [0,1,1,1, 0.5,0.451,0.882,0.82, 1,0,0,0, 0,1, 0.5,0.6, 1,0] } },
          s: { a: 0, k: [0,0] }, e: { a: 0, k: [100,0] }, t: 1,
          h: { a: 0, k: 0 },
          a: { a: 1, k: [
            { i:{x:[0.833],y:[0.833]}, o:{x:[0.167],y:[0.167]}, t:0, s:[0] },
            { t: DUR, s:[-720] }
          ]},
          lc: 2, lj: 1, bm: 0
        },
        { ty: "tm", s: { a: 0, k: 0 }, e: { a: 0, k: 15 },
          o: { a: 1, k: [
            { i:{x:[0.833],y:[0.833]}, o:{x:[0.167],y:[0.167]}, t:0, s:[0] },
            { t: DUR, s:[720] }
          ]}, m: 1
        },
        { ty:"tr", p:{a:0,k:[0,0]}, a:{a:0,k:[0,0]}, s:{a:0,k:[100,100]}, r:{a:0,k:0}, o:{a:0,k:100} }
      ], nm: "shim", bm: 0
    }],
    ip: 0, op: DUR, st: 0, bm: 0
  };
}

// ── Layer 4: Outer Glow (behind ring, pulsing) ──
function makeGlow() {
  return {
    ddd: 0, ind: 4, ty: 4, nm: "Glow", sr: 1,
    ks: {
      o: opacity_pulse(12, 32, 4),
      p: { a: 0, k: [CX, CY, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] }
    },
    ao: 0,
    shapes: [{
      ty: "gr", it: [
        { d: 1, ty: "el", s: { a: 0, k: [460, 460] }, p: { a: 0, k: [0, 0] } },
        { ty: "gs", o: { a: 0, k: 100 }, w: { a: 0, k: 16 },
          g: { p: 3, k: { a: 0, k: [0,0.078,0.722,0.651, 0.5,0.024,0.714,0.831, 1,0.078,0.722,0.651] } },
          s: { a: 0, k: [0,0] }, e: { a: 0, k: [100,0] }, t: 1,
          h: { a: 0, k: 0 }, a: { a: 0, k: 0 }, lc: 1, lj: 1, bm: 0
        },
        { ty:"tr", p:{a:0,k:[0,0]}, a:{a:0,k:[0,0]}, s:{a:0,k:[100,100]}, r:{a:0,k:0}, o:{a:0,k:100} }
      ], nm: "gl", bm: 0
    }],
    ip: 0, op: DUR, st: 0, bm: 0
  };
}

// ── Layer 5: Main Ring (teal-cyan gradient) ──
function makeRing() {
  return {
    ddd: 0, ind: 5, ty: 4, nm: "Ring", sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      p: { a: 0, k: [CX, CY, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] }
    },
    ao: 0,
    shapes: [{
      ty: "gr", it: [
        { d: 1, ty: "el", s: { a: 0, k: [440, 440] }, p: { a: 0, k: [0, 0] } },
        { ty: "gs", o: { a: 0, k: 100 }, w: { a: 0, k: 18 },
          g: { p: 5, k: { a: 0, k: [
            0,0.051,0.373,0.408,
            0.25,0.078,0.722,0.651,
            0.5,0.024,0.714,0.831,
            0.75,0.078,0.722,0.651,
            1,0.051,0.373,0.408
          ] } },
          s: { a: 0, k: [0,0] }, e: { a: 0, k: [100,0] }, t: 1,
          h: { a: 0, k: 0 },
          a: { a: 1, k: [
            { i:{x:[0.833],y:[0.833]}, o:{x:[0.167],y:[0.167]}, t:0, s:[0] },
            { t: DUR, s:[360] }
          ]},
          lc: 1, lj: 1, bm: 0
        },
        { ty:"tr", p:{a:0,k:[0,0]}, a:{a:0,k:[0,0]}, s:{a:0,k:[100,100]}, r:{a:0,k:0}, o:{a:0,k:100} }
      ], nm: "rg", bm: 0
    }],
    ip: 0, op: DUR, st: 0, bm: 0
  };
}

// ── Layer 6: Inner glow ring ──
function makeInner() {
  return {
    ddd: 0, ind: 6, ty: 4, nm: "Inner", sr: 1,
    ks: {
      o: opacity_pulse(30, 65, 4),
      p: { a: 0, k: [CX, CY, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] }
    },
    ao: 0,
    shapes: [{
      ty: "gr", it: [
        { d: 1, ty: "el", s: { a: 0, k: [420, 420] }, p: { a: 0, k: [0, 0] } },
        { ty: "st", c: { a: 0, k: TEAL_LIGHT }, o: { a: 0, k: 100 }, w: { a: 0, k: 1.5 }, lc: 1, lj: 1, bm: 0 },
        { ty:"tr", p:{a:0,k:[0,0]}, a:{a:0,k:[0,0]}, s:{a:0,k:[100,100]}, r:{a:0,k:0}, o:{a:0,k:100} }
      ], nm: "in", bm: 0
    }],
    ip: 0, op: DUR, st: 0, bm: 0
  };
}

// ── Layer 7: Ribbon Banner (bottom, for username) ──
function makeRibbon() {
  // Ribbon shape: curved banner at bottom
  const ribbonY = 200; // relative to center (bottom of ring)
  return {
    ddd: 0, ind: 7, ty: 4, nm: "Ribbon", sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      p: { a: 0, k: [CX, CY + 15, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] }
    },
    ao: 0,
    shapes: [
      // Main ribbon body
      {
        ty: "gr", it: [
          { ty: "sh", ks: { a: 0, k: {
            i: [[0,0],[15,-8],[0,0],[-15,-8]],
            o: [[0,0],[-15,8],[0,0],[15,8]],
            v: [[-140,ribbonY-15],[0,ribbonY-28],[140,ribbonY-15],[0,ribbonY-2]],
            c: true
          }}},
          { ty: "gf", o: { a: 0, k: 100 },
            g: { p: 3, k: { a: 0, k: [0,0.051,0.373,0.408, 0.5,0.078,0.722,0.651, 1,0.024,0.714,0.831] } },
            s: { a: 0, k: [-140, ribbonY-15] },
            e: { a: 0, k: [140, ribbonY-15] },
            t: 1, r: 1
          },
          { ty:"tr", p:{a:0,k:[0,0]}, a:{a:0,k:[0,0]}, s:{a:0,k:[100,100]}, r:{a:0,k:0}, o:{a:0,k:100} }
        ], nm: "rb", bm: 0
      },
      // Left fold
      {
        ty: "gr", it: [
          { ty: "sh", ks: { a: 0, k: {
            i: [[0,0],[0,0],[0,0]],
            o: [[0,0],[0,0],[0,0]],
            v: [[-140,ribbonY-15],[-160,ribbonY-5],[-140,ribbonY+5]],
            c: true
          }}},
          { ty: "fl", c: { a: 0, k: TEAL_DARK }, o: { a: 0, k: 80 }, r: 1, bm: 0 },
          { ty:"tr", p:{a:0,k:[0,0]}, a:{a:0,k:[0,0]}, s:{a:0,k:[100,100]}, r:{a:0,k:0}, o:{a:0,k:100} }
        ], nm: "lf", bm: 0
      },
      // Right fold
      {
        ty: "gr", it: [
          { ty: "sh", ks: { a: 0, k: {
            i: [[0,0],[0,0],[0,0]],
            o: [[0,0],[0,0],[0,0]],
            v: [[140,ribbonY-15],[160,ribbonY-5],[140,ribbonY+5]],
            c: true
          }}},
          { ty: "fl", c: { a: 0, k: TEAL_DARK }, o: { a: 0, k: 80 }, r: 1, bm: 0 },
          { ty:"tr", p:{a:0,k:[0,0]}, a:{a:0,k:[0,0]}, s:{a:0,k:[100,100]}, r:{a:0,k:0}, o:{a:0,k:100} }
        ], nm: "rf", bm: 0
      },
      // Ribbon shimmer (animated shine across ribbon)
      {
        ty: "gr", it: [
          { ty: "sh", ks: { a: 0, k: {
            i: [[0,0],[15,-6],[0,0],[-15,-6]],
            o: [[0,0],[-15,6],[0,0],[15,6]],
            v: [[-130,ribbonY-14],[0,ribbonY-24],[130,ribbonY-14],[0,ribbonY-4]],
            c: true
          }}},
          { ty: "gf", o: { a: 0, k: 30 },
            g: { p: 3, k: { a: 0, k: [0,1,1,1, 0.5,0.451,0.882,0.82, 1,1,1,1, 0,0, 0.5,0.4, 1,0] } },
            s: { a: 1, k: [
              { i:easeIn, o:easeOut, t:0, s:[-130,ribbonY-15] },
              { i:easeIn, o:easeOut, t:75, s:[130,ribbonY-15] },
              { t:DUR, s:[-130,ribbonY-15] }
            ]},
            e: { a: 1, k: [
              { i:easeIn, o:easeOut, t:0, s:[-100,ribbonY-15] },
              { i:easeIn, o:easeOut, t:75, s:[160,ribbonY-15] },
              { t:DUR, s:[-100,ribbonY-15] }
            ]},
            t: 1, r: 1
          },
          { ty:"tr", p:{a:0,k:[0,0]}, a:{a:0,k:[0,0]}, s:{a:0,k:[100,100]}, r:{a:0,k:0}, o:{a:0,k:100} }
        ], nm: "rs", bm: 0
      }
    ],
    ip: 0, op: DUR, st: 0, bm: 0
  };
}

// ── Compose ──
const lottie = {
  v: "5.7.0",
  meta: { g: "SopranoChat" },
  fr: FR,
  ip: 0,
  op: DUR,
  w: W,
  h: H,
  nm: "TealRibbon",
  ddd: 0,
  assets: [],
  layers: [
    makeSparkles(),   // ind 1 — top (avatarın üstünde)
    makeDust(),       // ind 2 — top (avatarın üstünde toz)
    makeShimmer(),    // ind 3 — parlama arki
    makeGlow(),       // ind 4 — dış glow
    makeRing(),       // ind 5 — ana halka
    makeInner(),      // ind 6 — iç çizgi
    makeRibbon(),     // ind 7 — kurdale (alt)
  ],
  markers: []
};

const out = path.join(__dirname, '..', 'assets', 'avatar_frames', 'TealRibbon.json');
fs.writeFileSync(out, JSON.stringify(lottie));
console.log(`✅ TealRibbon.json yazıldı → ${out} (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
