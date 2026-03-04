/**
 * galaxy.js — High-performance interactive rotating galaxy
 * Renders on a 2D Canvas with thousands of stars, spiral arms,
 * dust lanes, nebula glow, and mouse-parallax interaction.
 */

(function () {
  'use strict';

  const canvas = document.getElementById('galaxy-canvas');
  const ctx    = canvas.getContext('2d');

  /* ── Config ──────────────────────────────────────────── */
  const CFG = {
    STAR_COUNT:       5200,
    DUST_COUNT:       900,
    NEBULA_COUNT:     14,
    ARMS:             4,
    ARM_TWIST:        2.8,       // radians of total arm curl
    ARM_WIDTH:        0.36,      // spread around arm centre
    CORE_RADIUS:      0.14,      // fraction of min-dimension
    DISK_RADIUS:      0.44,
    BASE_ROT_SPEED:   0.00018,   // rad/frame
    DRIFT_SPEED:      0.000035,
    PARALLAX:         0.022,
    BG_COLOR:         '#02030a',
    CORE_COLORS:      ['#ffe8b0','#ffd580','#ffb347','#ff9a3c'],
    ARM_COLORS:       ['#b0c8ff','#8aaeff','#ffffff','#d0e8ff'],
    DUST_COLOR:       'rgba(120,90,200,',
    NEBULA_PALETTES:  [
      ['#1a0033','#3d0066','#7b00cc'],
      ['#002244','#004488','#0088ff'],
      ['#001a00','#003300','#006600'],
      ['#330011','#660022','#cc0044'],
    ],
  };

  /* ── State ───────────────────────────────────────────── */
  let W, H, CX, CY, RMIN;
  let angle    = 0;
  let mouse    = { x: 0, y: 0 };
  let target   = { x: 0, y: 0 };
  let raf;

  const stars   = [];
  const dusts   = [];
  const nebulae = [];

  /* ── Utility ─────────────────────────────────────────── */
  const rand  = (a, b) => a + Math.random() * (b - a);
  const randN = (sigma = 1) => {
    // Box-Muller normal distribution
    const u = 1 - Math.random();
    const v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
  };
  const lerp  = (a, b, t) => a + (b - a) * t;

  /* ── Resize ──────────────────────────────────────────── */
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    W  = rect.width;
    H  = rect.height;
    CX = W / 2;
    CY = H / 2;
    RMIN = Math.min(W, H);

    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    buildScene();
  }

  /* ── Scene Builder ───────────────────────────────────── */
  function buildScene() {
    stars.length   = 0;
    dusts.length   = 0;
    nebulae.length = 0;

    buildNebulae();
    buildStars();
    buildDust();
  }

  function buildNebulae() {
    const diskR = CFG.DISK_RADIUS * RMIN;
    for (let i = 0; i < CFG.NEBULA_COUNT; i++) {
      const arm    = (i % CFG.ARMS);
      const armAng = (arm / CFG.ARMS) * Math.PI * 2;
      const r      = rand(0.08, 0.9) * diskR;
      const twist  = (r / diskR) * CFG.ARM_TWIST;
      const baseA  = armAng + twist;
      const spread = randN(0.18);
      const a      = baseA + spread;

      const pal  = CFG.NEBULA_PALETTES[i % CFG.NEBULA_PALETTES.length];
      const size = rand(diskR * 0.08, diskR * 0.26);

      nebulae.push({
        ox: Math.cos(a) * r,
        oy: Math.sin(a) * r,
        size,
        pal,
        alpha: rand(0.025, 0.07),
      });
    }

    // Core nebula
    nebulae.push({
      ox: 0, oy: 0,
      size: CFG.CORE_RADIUS * RMIN * 1.6,
      pal: ['#221100','#442200','#885500'],
      alpha: 0.18,
      isCore: true,
    });
  }

  function buildStars() {
    const coreR = CFG.CORE_RADIUS * RMIN;
    const diskR = CFG.DISK_RADIUS * RMIN;

    for (let i = 0; i < CFG.STAR_COUNT; i++) {
      // 30 % core stars, 70 % disk stars
      const isCore = i < CFG.STAR_COUNT * 0.30;

      let x, y, r;
      if (isCore) {
        const ang = rand(0, Math.PI * 2);
        r = Math.abs(randN(0.35)) * coreR;
        x = Math.cos(ang) * r;
        y = Math.sin(ang) * r;
      } else {
        const arm    = Math.floor(rand(0, CFG.ARMS));
        const armAng = (arm / CFG.ARMS) * Math.PI * 2;
        r = rand(coreR * 0.5, diskR);
        const twist  = (r / diskR) * CFG.ARM_TWIST;
        const baseA  = armAng + twist;
        const spread = randN(CFG.ARM_WIDTH * 0.5);
        const a      = baseA + spread;
        x = Math.cos(a) * r;
        y = Math.sin(a) * r;
      }

      // Radial fraction for colouring
      const frac = Math.sqrt(x * x + y * y) / diskR;

      // Star size + twinkle speed
      const sz = isCore
        ? rand(0.4, 1.8)
        : rand(0.25, frac < 0.3 ? 1.6 : 1.2);

      // Colour: core is warm, arms are cool-white
      let col;
      if (isCore || frac < 0.2) {
        col = CFG.CORE_COLORS[Math.floor(rand(0, CFG.CORE_COLORS.length))];
      } else {
        col = CFG.ARM_COLORS[Math.floor(rand(0, CFG.ARM_COLORS.length))];
      }

      stars.push({
        ox: x, oy: y,          // offset from galaxy centre
        size: sz,
        color: col,
        alpha: rand(0.5, 1.0),
        twinkleSpeed: rand(0.008, 0.032),
        twinklePhase: rand(0, Math.PI * 2),
        depth: rand(0.6, 1.0), // parallax depth
      });
    }
  }

  function buildDust() {
    const diskR = CFG.DISK_RADIUS * RMIN;

    for (let i = 0; i < CFG.DUST_COUNT; i++) {
      const arm    = Math.floor(rand(0, CFG.ARMS));
      const armAng = (arm / CFG.ARMS) * Math.PI * 2 + Math.PI / CFG.ARMS; // offset between star arms
      const r      = rand(diskR * 0.1, diskR * 0.9);
      const twist  = (r / diskR) * CFG.ARM_TWIST;
      const a      = armAng + twist + randN(CFG.ARM_WIDTH * 0.7);

      dusts.push({
        ox: Math.cos(a) * r,
        oy: Math.sin(a) * r,
        size: rand(4, 22),
        alpha: rand(0.012, 0.055),
      });
    }
  }

  /* ── Draw Helpers ────────────────────────────────────── */
  function drawBackground() {
    ctx.fillStyle = CFG.BG_COLOR;
    ctx.fillRect(0, 0, W, H);

    // subtle radial vignette on sky
    const vg = ctx.createRadialGradient(CX, CY, RMIN * 0.2, CX, CY, RMIN * 0.9);
    vg.addColorStop(0, 'rgba(5,8,30,0)');
    vg.addColorStop(1, 'rgba(2,3,10,0.85)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  function drawNebula(n, cosA, sinA, px, py) {
    const rx = n.ox * cosA - n.oy * sinA + CX + px;
    const ry = n.ox * sinA + n.oy * cosA + CY + py;

    const g = ctx.createRadialGradient(rx, ry, 0, rx, ry, n.size);
    g.addColorStop(0,   hexAlpha(n.pal[2], n.alpha * 1.0));
    g.addColorStop(0.4, hexAlpha(n.pal[1], n.alpha * 0.6));
    g.addColorStop(0.8, hexAlpha(n.pal[0], n.alpha * 0.2));
    g.addColorStop(1,   'rgba(0,0,0,0)');

    ctx.save();
    ctx.globalCompositeOperation = n.isCore ? 'screen' : 'screen';
    ctx.beginPath();
    ctx.arc(rx, ry, n.size, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  function drawDust(d, cosA, sinA, px, py) {
    const rx = d.ox * cosA - d.oy * sinA + CX + px;
    const ry = d.ox * sinA + d.oy * cosA + CY + py;

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.beginPath();
    ctx.arc(rx, ry, d.size, 0, Math.PI * 2);
    ctx.fillStyle = CFG.DUST_COLOR + d.alpha + ')';
    ctx.fill();
    ctx.restore();
  }

  function drawStar(s, cosA, sinA, px, py, t) {
    const rx = s.ox * cosA - s.oy * sinA + CX + px * s.depth;
    const ry = s.ox * sinA + s.oy * cosA + CY + py * s.depth;

    // Twinkle
    const twinkle = 0.72 + 0.28 * Math.sin(t * s.twinkleSpeed + s.twinklePhase);
    const a = s.alpha * twinkle;
    const sz = s.size * (0.9 + 0.1 * twinkle);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Glow halo for larger stars
    if (sz > 1.0) {
      const glow = ctx.createRadialGradient(rx, ry, 0, rx, ry, sz * 3.5);
      glow.addColorStop(0,   hexAlpha(s.color, a * 0.55));
      glow.addColorStop(0.5, hexAlpha(s.color, a * 0.1));
      glow.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(rx, ry, sz * 3.5, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    // Star core
    ctx.beginPath();
    ctx.arc(rx, ry, sz, 0, Math.PI * 2);
    ctx.fillStyle = hexAlpha(s.color, a);
    ctx.fill();

    ctx.restore();
  }

  function drawCore(cosA, sinA, px, py) {
    const rx = CX + px;
    const ry = CY + py;
    const cr = CFG.CORE_RADIUS * RMIN;

    // Core glow layers
    const layers = [
      { r: cr * 3.0, a: 0.04, c: '#331100' },
      { r: cr * 1.8, a: 0.12, c: '#885500' },
      { r: cr * 1.0, a: 0.30, c: '#ffcc66' },
      { r: cr * 0.4, a: 0.70, c: '#fff5cc' },
      { r: cr * 0.12,a: 0.95, c: '#ffffff' },
    ];

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const l of layers) {
      const g = ctx.createRadialGradient(rx, ry, 0, rx, ry, l.r);
      g.addColorStop(0,   hexAlpha(l.c, l.a));
      g.addColorStop(0.5, hexAlpha(l.c, l.a * 0.4));
      g.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(rx, ry, l.r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.restore();
  }

  /* ── Hex + Alpha ─────────────────────────────────────── */
  function hexAlpha(hex, alpha) {
    // Fast conversion; hex may be #rrggbb
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* ── Mouse Parallax ──────────────────────────────────── */
  canvas.parentElement.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    target.x = (e.clientX - rect.left - W / 2) * CFG.PARALLAX;
    target.y = (e.clientY - rect.top  - H / 2) * CFG.PARALLAX;
  });

  canvas.parentElement.addEventListener('mouseleave', () => {
    target.x = 0;
    target.y = 0;
  });

  /* ── Main Loop ───────────────────────────────────────── */
  let t = 0;

  function frame() {
    t++;
    angle += CFG.BASE_ROT_SPEED;

    // Smooth parallax
    mouse.x = lerp(mouse.x, target.x, 0.04);
    mouse.y = lerp(mouse.y, target.y, 0.04);

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const px   = mouse.x;
    const py   = mouse.y;

    drawBackground();

    // Nebulae (back layer)
    for (const n of nebulae) {
      if (!n.isCore) drawNebula(n, cosA, sinA, px, py);
    }

    // Dust lanes
    for (const d of dusts) drawDust(d, cosA, sinA, px, py);

    // Stars
    for (const s of stars) drawStar(s, cosA, sinA, px, py, t);

    // Core nebula
    drawNebula(nebulae[nebulae.length - 1], cosA, sinA, px, py);

    // Bright core
    drawCore(cosA, sinA, px, py);

    raf = requestAnimationFrame(frame);
  }

  /* ── Init ────────────────────────────────────────────── */
  function init() {
    resize();
    frame();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);

  init();

})();
