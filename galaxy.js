/**
 * galaxy.js — High-performance realistic rotating galaxy
 *
 * Key optimisations vs original:
 *  • All screen-blend draws batched in ONE save/restore (vs per-particle)
 *  • All multiply-blend draws batched in ONE save/restore
 *  • DPR capped at 2 (no 3× canvas on Retina 3× screens)
 *  • FPS capped at 40 (background animation doesn't need 60)
 *  • Particle counts reduced: 2 200 stars / 360 dust / 9 nebulae
 *  • Off-screen particles skipped
 *  • Glow gradient only for sz > 1.0 (≈ 30 % of stars)
 *  • rgb[] stored at build-time; rgba() builds string directly
 *
 * Realism additions:
 *  • Disk perspective tilt (y × 0.72 squish)
 *  • Differential rotation: inner stars rotate slightly faster
 *  • Arm twist increased to 3.4 rad; sharper arm density falloff
 *  • Warm-to-blue colour gradient across radius
 *  • Brighter, multi-layered galactic core
 *  • Subtle inter-arm dust haze
 */

(function () {
  'use strict';

  const canvas = document.getElementById('galaxy-canvas');
  const ctx    = canvas.getContext('2d', { alpha: false });

  /* ── Config ─────────────────────────────────────────── */
  const CFG = {
    STAR_COUNT:      2200,
    DUST_COUNT:      360,
    NEBULA_COUNT:    9,
    ARMS:            4,
    ARM_TWIST:       3.4,     // tighter spiral
    ARM_WIDTH:       0.30,
    CORE_RADIUS:     0.14,
    DISK_RADIUS:     0.43,
    BASE_ROT_SPEED:  0.00026, // slightly faster than original
    PARALLAX:        0.020,
    TILT:            0.72,    // y-axis squish → disk perspective
    BG_COLOR:        '#02030a',
    CORE_COLORS:     ['#ffe8b0','#ffd580','#ffb347','#ff9a3c','#ffcc66'],
    ARM_COLORS:      ['#b0c8ff','#8aaeff','#ffffff','#d0e8ff','#c8ddff'],
    NEBULA_PALETTES: [
      ['#1a0033','#3d0066','#7b00cc'],
      ['#002244','#004488','#0088ff'],
      ['#001a00','#003300','#006600'],
      ['#330011','#660022','#cc0044'],
    ],
    FPS_CAP: 40,
  };

  /* ── State ──────────────────────────────────────────── */
  let W, H, CX, CY, RMIN;
  let angle    = 0;
  let mouse    = { x: 0, y: 0 };
  let target   = { x: 0, y: 0 };
  let lastFrame = 0;
  const FRAME_MS = 1000 / CFG.FPS_CAP;

  const stars   = [];
  const dusts   = [];
  const nebulae = [];

  /* ── Utilities ──────────────────────────────────────── */
  const rand  = (a, b) => a + Math.random() * (b - a);
  const randN = (s = 1) => {
    const u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * s;
  };
  const lerp  = (a, b, t) => a + (b - a) * t;

  // Parse hex once at build time; build rgba() cheaply in the render loop
  function hexRgb(hex) {
    return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
  }
  function rgba([r,g,b], a) {
    // Round alpha to 3 dp to avoid tiny string churn
    return `rgba(${r},${g},${b},${(a < 0 ? 0 : a).toFixed(3)})`;
  }

  /* ── Resize ─────────────────────────────────────────── */
  function resize() {
    const dpr  = Math.min(window.devicePixelRatio || 1, 2); // cap at 2×
    const rect = canvas.parentElement.getBoundingClientRect();
    W  = rect.width;  H  = rect.height;
    CX = W / 2;       CY = H / 2;
    RMIN = Math.min(W, H);

    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildScene();
  }

  /* ── Scene Builder ──────────────────────────────────── */
  function buildScene() {
    stars.length = 0; dusts.length = 0; nebulae.length = 0;
    buildNebulae();
    buildStars();
    buildDust();
  }

  function buildNebulae() {
    const diskR = CFG.DISK_RADIUS * RMIN;

    for (let i = 0; i < CFG.NEBULA_COUNT; i++) {
      const arm    = i % CFG.ARMS;
      const armAng = (arm / CFG.ARMS) * Math.PI * 2;
      const r      = rand(0.12, 0.88) * diskR;
      const twist  = (r / diskR) * CFG.ARM_TWIST;
      const a      = armAng + twist + randN(0.15);
      const pal    = CFG.NEBULA_PALETTES[i % CFG.NEBULA_PALETTES.length].map(hexRgb);
      const size   = rand(diskR * 0.07, diskR * 0.22);
      const alpha  = rand(0.03, 0.075);

      nebulae.push({
        ox: Math.cos(a) * r,
        oy: Math.sin(a) * r * CFG.TILT,
        size,
        // Pre-computed gradient colour stops
        c0: rgba(pal[2], alpha),
        c1: rgba(pal[1], alpha * 0.55),
        c2: rgba(pal[0], alpha * 0.18),
      });
    }

    // Galactic core nebula
    const cr = CFG.CORE_RADIUS * RMIN;
    nebulae.push({
      ox: 0, oy: 0,
      size: cr * 1.7,
      c0: 'rgba(140,88,0,0.18)',
      c1: 'rgba(70,35,0,0.10)',
      c2: 'rgba(35,18,0,0.03)',
      isCore: true,
    });
  }

  function buildStars() {
    const coreR = CFG.CORE_RADIUS * RMIN;
    const diskR = CFG.DISK_RADIUS * RMIN;
    const r0    = coreR * 0.6; // differential-rotation scale radius

    for (let i = 0; i < CFG.STAR_COUNT; i++) {
      const isCore = i < CFG.STAR_COUNT * 0.28;
      let x, y, r;

      if (isCore) {
        const ang = rand(0, Math.PI * 2);
        r = Math.abs(randN(0.32)) * coreR;
        x = Math.cos(ang) * r;
        y = Math.sin(ang) * r * CFG.TILT;
      } else {
        const arm    = Math.floor(rand(0, CFG.ARMS));
        const armAng = (arm / CFG.ARMS) * Math.PI * 2;
        r = rand(coreR * 0.45, diskR);
        const twist  = (r / diskR) * CFG.ARM_TWIST;
        const a      = armAng + twist + randN(CFG.ARM_WIDTH * 0.48);
        x = Math.cos(a) * r;
        y = Math.sin(a) * r * CFG.TILT;
      }

      const frac = Math.sqrt(x * x + (y / CFG.TILT) ** 2) / diskR;
      const sz   = isCore
        ? rand(0.5, 1.9)
        : rand(0.2, frac < 0.25 ? 1.5 : 1.0);

      const col = (isCore || frac < 0.18)
        ? CFG.CORE_COLORS[Math.floor(rand(0, CFG.CORE_COLORS.length))]
        : CFG.ARM_COLORS[Math.floor(rand(0, CFG.ARM_COLORS.length))];

      // Differential rotation: angular velocity ∝ 1/(1+r/r0)
      // Inner stars slightly faster → arms wind realistically over time
      const angVel = CFG.BASE_ROT_SPEED * (1 + r0 / ((r || 1) + r0));

      stars.push({
        ox: x, oy: y,         // initial disk-plane offsets
        r,
        angVel,               // per-star angular velocity
        localAngle: 0,        // accumulated extra rotation vs global angle
        size: sz,
        rgb:  hexRgb(col),
        alpha: rand(0.55, 1.0),
        twinkleSpeed: rand(0.006, 0.024),
        twinklePhase: rand(0, Math.PI * 2),
        depth: rand(0.65, 1.0),
        hasGlow: sz > 1.0,
      });
    }
  }

  function buildDust() {
    const diskR = CFG.DISK_RADIUS * RMIN;

    for (let i = 0; i < CFG.DUST_COUNT; i++) {
      const arm    = Math.floor(rand(0, CFG.ARMS));
      const armAng = (arm / CFG.ARMS) * Math.PI * 2 + Math.PI / CFG.ARMS;
      const r      = rand(diskR * 0.08, diskR * 0.88);
      const twist  = (r / diskR) * CFG.ARM_TWIST;
      const a      = armAng + twist + randN(CFG.ARM_WIDTH * 0.62);

      dusts.push({
        ox:    Math.cos(a) * r,
        oy:    Math.sin(a) * r * CFG.TILT,
        size:  rand(3, 16),
        color: `rgba(120,90,200,${rand(0.010, 0.048).toFixed(3)})`,
      });
    }
  }

  /* ── Render ─────────────────────────────────────────── */
  function drawBg() {
    ctx.fillStyle = CFG.BG_COLOR;
    ctx.fillRect(0, 0, W, H);

    const vg = ctx.createRadialGradient(CX, CY, RMIN * 0.15, CX, CY, RMIN * 0.95);
    vg.addColorStop(0, 'rgba(5,8,30,0)');
    vg.addColorStop(1, 'rgba(2,3,10,0.88)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  let t = 0;

  function drawScene(cosA, sinA, px, py) {

    /* ── Pass 1: nebulae — screen blend ── */
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const n of nebulae) {
      const rx = n.ox * cosA - n.oy * sinA + CX + px;
      const ry = n.ox * sinA + n.oy * cosA + CY + py;
      const g  = ctx.createRadialGradient(rx, ry, 0, rx, ry, n.size);
      g.addColorStop(0,   n.c0);
      g.addColorStop(0.4, n.c1);
      g.addColorStop(0.8, n.c2);
      g.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(rx, ry, n.size, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.restore();

    /* ── Pass 2: dust lanes — multiply blend ── */
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    for (const d of dusts) {
      const rx = d.ox * cosA - d.oy * sinA + CX + px;
      const ry = d.ox * sinA + d.oy * cosA + CY + py;
      ctx.beginPath();
      ctx.arc(rx, ry, d.size, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.fill();
    }
    ctx.restore();

    /* ── Pass 3: stars + core — screen blend ── */
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (const s of stars) {
      // Apply accumulated differential-rotation offset, then global rotation
      const lc = Math.cos(s.localAngle);
      const ls = Math.sin(s.localAngle);
      const lx = s.ox * lc - s.oy * ls;
      const ly = s.ox * ls + s.oy * lc;

      const rx = lx * cosA - ly * sinA + CX + px * s.depth;
      const ry = lx * sinA + ly * cosA + CY + py * s.depth;

      // Skip stars outside the viewport
      if (rx < -20 || rx > W + 20 || ry < -20 || ry > H + 20) continue;

      const twinkle = 0.75 + 0.25 * Math.sin(t * s.twinkleSpeed + s.twinklePhase);
      const a  = s.alpha * twinkle;
      const sz = s.size  * (0.92 + 0.08 * twinkle);

      // Glow halo (only for larger stars — reduces gradient count by ~70 %)
      if (s.hasGlow) {
        const gr   = sz * 3.2;
        const glow = ctx.createRadialGradient(rx, ry, 0, rx, ry, gr);
        glow.addColorStop(0,   rgba(s.rgb, a * 0.50));
        glow.addColorStop(0.5, rgba(s.rgb, a * 0.08));
        glow.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(rx, ry, gr, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      // Star core
      ctx.beginPath();
      ctx.arc(rx, ry, sz, 0, Math.PI * 2);
      ctx.fillStyle = rgba(s.rgb, a);
      ctx.fill();
    }

    // Bright galactic core — rendered in the same screen-blend save/restore
    {
      const cr = CFG.CORE_RADIUS * RMIN;
      const rx = CX + px;
      const ry = CY + py;
      const layers = [
        { r: cr * 3.4, a: 0.032, rgb: [51,  17,  0  ] },
        { r: cr * 2.0, a: 0.10,  rgb: [140, 88,  0  ] },
        { r: cr * 1.0, a: 0.28,  rgb: [255, 204, 102] },
        { r: cr * 0.4, a: 0.74,  rgb: [255, 245, 210] },
        { r: cr * 0.14,a: 0.96,  rgb: [255, 255, 255] },
      ];
      for (const l of layers) {
        const g = ctx.createRadialGradient(rx, ry, 0, rx, ry, l.r);
        g.addColorStop(0,    rgba(l.rgb, l.a));
        g.addColorStop(0.45, rgba(l.rgb, l.a * 0.35));
        g.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(rx, ry, l.r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /* ── Mouse Parallax ─────────────────────────────────── */
  canvas.parentElement.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    target.x = (e.clientX - rect.left - W / 2) * CFG.PARALLAX;
    target.y = (e.clientY - rect.top  - H / 2) * CFG.PARALLAX;
  });
  canvas.parentElement.addEventListener('mouseleave', () => {
    target.x = 0; target.y = 0;
  });

  /* ── Main Loop ──────────────────────────────────────── */
  function frame(now) {
    // FPS cap: skip this tick if we're ahead of schedule
    if (now - lastFrame < FRAME_MS) {
      requestAnimationFrame(frame);
      return;
    }
    lastFrame = now;

    t++;
    angle += CFG.BASE_ROT_SPEED;

    // Accumulate per-star differential rotation
    for (const s of stars) {
      s.localAngle += (s.angVel - CFG.BASE_ROT_SPEED);
    }

    // Smooth parallax
    mouse.x = lerp(mouse.x, target.x, 0.04);
    mouse.y = lerp(mouse.y, target.y, 0.04);

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    drawBg();
    drawScene(cosA, sinA, mouse.x, mouse.y);

    requestAnimationFrame(frame);
  }

  /* ── Init ───────────────────────────────────────────── */
  function init() {
    resize();
    requestAnimationFrame(frame);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);

  init();

})();
