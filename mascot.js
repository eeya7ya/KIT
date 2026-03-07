/* ══════════════════════════════════════════════════════
   KIT Mascot — Interactive SVG Pet
   Tracks mouse, reacts to sign-in hover, blinks, breathes
   ══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── State ─────────────────────────────────────────── */
  let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let mood = 'idle';   // idle | laugh | wonder | track | wave
  let blinkTimer = null;
  let moodTimer = null;
  let floatPhase = 0;
  let rafId = null;

  /* ── Build DOM ──────────────────────────────────────── */
  const wrap = document.getElementById('mascot-wrap');
  if (!wrap) return;

  wrap.innerHTML = `
  <svg id="mascot-svg" viewBox="0 0 160 180" width="160" height="180"
       xmlns="http://www.w3.org/2000/svg" style="overflow:visible">

    <!-- Shadow -->
    <ellipse id="m-shadow" cx="80" cy="172" rx="36" ry="7"
      fill="rgba(180,140,60,0.18)" />

    <!-- Body blob -->
    <path id="m-body" d="
      M 80 20
      C 120 18, 145 45, 144 80
      C 143 115, 122 148, 80 150
      C 38 148, 17 115, 16 80
      C 15 45, 40 18, 80 20 Z"
      fill="url(#bodyGrad)"
      stroke="rgba(217,119,6,0.25)" stroke-width="1.5" />

    <!-- Ear left -->
    <ellipse id="m-ear-l" cx="26" cy="62" rx="12" ry="16"
      fill="url(#earGrad)" stroke="rgba(217,119,6,0.2)" stroke-width="1"/>
    <!-- Ear right -->
    <ellipse id="m-ear-r" cx="134" cy="62" rx="12" ry="16"
      fill="url(#earGrad)" stroke="rgba(217,119,6,0.2)" stroke-width="1"/>

    <!-- Cheek blush left -->
    <ellipse id="m-blush-l" cx="38" cy="98" rx="14" ry="9"
      fill="rgba(239,110,80,0.18)" />
    <!-- Cheek blush right -->
    <ellipse id="m-blush-r" cx="122" cy="98" rx="14" ry="9"
      fill="rgba(239,110,80,0.18)" />

    <!-- Eye left -->
    <g id="m-eye-l">
      <!-- White -->
      <ellipse cx="58" cy="76" rx="16" ry="16" fill="white"
        filter="url(#eyeShadow)"/>
      <!-- Iris -->
      <circle id="m-iris-l" cx="58" cy="76" r="9" fill="url(#irisGrad)"/>
      <!-- Pupil -->
      <circle id="m-pupil-l" cx="58" cy="76" r="5" fill="#1a1714"/>
      <!-- Highlight -->
      <circle cx="63" cy="71" r="2.5" fill="rgba(255,255,255,0.9)"/>
      <!-- Lid (for blink) -->
      <rect id="m-lid-l" x="42" y="60" width="32" height="0"
        rx="4" fill="#f5ead0"/>
    </g>

    <!-- Eye right -->
    <g id="m-eye-r">
      <ellipse cx="102" cy="76" rx="16" ry="16" fill="white"
        filter="url(#eyeShadow)"/>
      <circle id="m-iris-r" cx="102" cy="76" r="9" fill="url(#irisGrad)"/>
      <circle id="m-pupil-r" cx="102" cy="76" r="5" fill="#1a1714"/>
      <circle cx="107" cy="71" r="2.5" fill="rgba(255,255,255,0.9)"/>
      <rect id="m-lid-r" x="86" y="60" width="32" height="0"
        rx="4" fill="#f5ead0"/>
    </g>

    <!-- Eyebrows -->
    <path id="m-brow-l" d="M 46 60 Q 58 56 70 60"
      fill="none" stroke="#a0785a" stroke-width="2.5" stroke-linecap="round"/>
    <path id="m-brow-r" d="M 90 60 Q 102 56 114 60"
      fill="none" stroke="#a0785a" stroke-width="2.5" stroke-linecap="round"/>

    <!-- Nose -->
    <ellipse cx="80" cy="100" rx="5" ry="3.5"
      fill="rgba(160,120,90,0.35)"/>

    <!-- Mouth group -->
    <g id="m-mouth">
      <!-- Smile (default) -->
      <path id="m-smile" d="M 64 115 Q 80 128 96 115"
        fill="none" stroke="#c0785a" stroke-width="2.8" stroke-linecap="round"/>
      <!-- Laugh (open mouth) — hidden by default -->
      <g id="m-laugh" visibility="hidden">
        <path d="M 62 114 Q 80 134 98 114"
          fill="#d97040" stroke="none"/>
        <path d="M 62 114 Q 80 134 98 114"
          fill="none" stroke="#c0785a" stroke-width="2.8" stroke-linecap="round"/>
        <ellipse cx="80" cy="122" rx="10" ry="6" fill="#b05030"/>
        <!-- Teeth -->
        <rect x="71" y="114" width="9" height="5" rx="2" fill="white"/>
        <rect x="80" y="114" width="9" height="5" rx="2" fill="white"/>
      </g>
      <!-- Wonder mouth (small 'o') -->
      <ellipse id="m-wonder-mouth" cx="80" cy="118" rx="6" ry="7"
        fill="#d97040" stroke="#c0785a" stroke-width="2"
        visibility="hidden"/>
    </g>

    <!-- Sparkles for laugh mode -->
    <g id="m-sparkles" visibility="hidden">
      <text x="18" y="50" font-size="14" opacity="0.9">✨</text>
      <text x="128" y="44" font-size="12" opacity="0.9">✨</text>
      <text x="136" y="110" font-size="10" opacity="0.8">⭐</text>
    </g>

    <!-- Wonder swirl -->
    <g id="m-wonder-swirl" visibility="hidden">
      <path d="M 104 30 Q 118 18 126 28 Q 134 38 122 44"
        fill="none" stroke="#7c3aed" stroke-width="2.5"
        stroke-linecap="round" opacity="0.7"/>
      <circle cx="122" cy="44" r="3" fill="#7c3aed" opacity="0.7"/>
    </g>

    <!-- Defs -->
    <defs>
      <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fff8ee"/>
        <stop offset="100%" stop-color="#f5e4c0"/>
      </linearGradient>
      <linearGradient id="earGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f5e0b0"/>
        <stop offset="100%" stop-color="#e8c888"/>
      </linearGradient>
      <radialGradient id="irisGrad" cx="40%" cy="35%">
        <stop offset="0%" stop-color="#d97706"/>
        <stop offset="60%" stop-color="#b45309"/>
        <stop offset="100%" stop-color="#78350f"/>
      </radialGradient>
      <filter id="eyeShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="2"
          flood-color="rgba(0,0,0,0.12)"/>
      </filter>
    </defs>
  </svg>`;

  /* ── Element refs ───────────────────────────────────── */
  const svg      = document.getElementById('mascot-svg');
  const body     = document.getElementById('m-body');
  const shadow   = document.getElementById('m-shadow');
  const irisL    = document.getElementById('m-iris-l');
  const irisR    = document.getElementById('m-iris-r');
  const pupilL   = document.getElementById('m-pupil-l');
  const pupilR   = document.getElementById('m-pupil-r');
  const lidL     = document.getElementById('m-lid-l');
  const lidR     = document.getElementById('m-lid-r');
  const browL    = document.getElementById('m-brow-l');
  const browR    = document.getElementById('m-brow-r');
  const smile    = document.getElementById('m-smile');
  const laugh    = document.getElementById('m-laugh');
  const wMouth   = document.getElementById('m-wonder-mouth');
  const sparkles = document.getElementById('m-sparkles');
  const swirl    = document.getElementById('m-wonder-swirl');
  const blushL   = document.getElementById('m-blush-l');
  const blushR   = document.getElementById('m-blush-r');

  /* ── Eye centres (in SVG space) ─────────────────────── */
  const EYE_L = { x: 58, y: 76 };
  const EYE_R = { x: 102, y: 76 };
  const EYE_RADIUS = 7; // max iris travel

  /* ── Helpers ────────────────────────────────────────── */
  function svgPoint(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    const scaleX = 160 / rect.width;
    const scaleY = 180 / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    };
  }

  function moveEye(eyeCenter, irisEl, pupilEl, svgMx, svgMy) {
    const dx = svgMx - eyeCenter.x;
    const dy = svgMy - eyeCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const travel = Math.min(dist / 18, 1);
    const ox = (dx / dist) * EYE_RADIUS * travel;
    const oy = (dy / dist) * EYE_RADIUS * travel;
    irisEl.setAttribute('cx', eyeCenter.x + ox);
    irisEl.setAttribute('cy', eyeCenter.y + oy);
    pupilEl.setAttribute('cx', eyeCenter.x + ox);
    pupilEl.setAttribute('cy', eyeCenter.y + oy);
  }

  function setMouth(type) {
    smile.setAttribute('visibility', type === 'idle' || type === 'track' ? 'visible' : 'hidden');
    laugh.setAttribute('visibility', type === 'laugh' ? 'visible' : 'hidden');
    wMouth.setAttribute('visibility', type === 'wonder' ? 'visible' : 'hidden');
  }

  function setBrows(type) {
    if (type === 'wonder') {
      browL.setAttribute('d', 'M 46 56 Q 58 50 70 56');
      browR.setAttribute('d', 'M 90 56 Q 102 50 114 56');
    } else if (type === 'laugh') {
      browL.setAttribute('d', 'M 46 57 Q 58 52 70 57');
      browR.setAttribute('d', 'M 90 57 Q 102 52 114 57');
    } else {
      browL.setAttribute('d', 'M 46 60 Q 58 56 70 60');
      browR.setAttribute('d', 'M 90 60 Q 102 56 114 60');
    }
  }

  function setBlush(on) {
    const op = on ? '0.32' : '0.18';
    blushL.setAttribute('fill', `rgba(239,110,80,${op})`);
    blushR.setAttribute('fill', `rgba(239,110,80,${op})`);
  }

  function applyMood(m) {
    mood = m;
    setMouth(m);
    setBrows(m);
    sparkles.setAttribute('visibility', m === 'laugh' ? 'visible' : 'hidden');
    swirl.setAttribute('visibility', m === 'wonder' ? 'visible' : 'hidden');
    setBlush(m === 'laugh');
  }

  /* ── Blink ──────────────────────────────────────────── */
  function blink() {
    const dur = 120;
    let t = 0;
    const step = 16;
    function tick() {
      t += step;
      const h = t < dur / 2 ? (t / (dur / 2)) * 32 : (1 - (t - dur / 2) / (dur / 2)) * 32;
      const clipped = Math.min(Math.max(h, 0), 32);
      [lidL, lidR].forEach(lid => lid.setAttribute('height', clipped));
      if (t < dur) requestAnimationFrame(tick);
      else [lidL, lidR].forEach(lid => lid.setAttribute('height', 0));
    }
    requestAnimationFrame(tick);
    scheduleBlink();
  }

  function scheduleBlink() {
    clearTimeout(blinkTimer);
    blinkTimer = setTimeout(blink, 2000 + Math.random() * 3500);
  }

  /* ── Idle mood rotation ─────────────────────────────── */
  function scheduleMoodCycle() {
    clearTimeout(moodTimer);
    const delay = 5000 + Math.random() * 5000;
    moodTimer = setTimeout(() => {
      if (mood === 'idle' || mood === 'track') {
        const roll = Math.random();
        if (roll < 0.35) {
          applyMood('wonder');
          setTimeout(() => applyMood('idle'), 2200);
        } else if (roll < 0.55) {
          applyMood('laugh');
          setTimeout(() => applyMood('idle'), 1800);
        }
      }
      scheduleMoodCycle();
    }, delay);
  }

  /* ── Render loop ────────────────────────────────────── */
  function render() {
    floatPhase += 0.022;
    const floatY = Math.sin(floatPhase) * 5;
    const floatS = 1 + Math.sin(floatPhase * 0.7) * 0.012; // subtle breathe

    wrap.style.transform = `translateY(${floatY}px) scaleX(${floatS})`;
    shadow.setAttribute('ry', 7 - Math.abs(Math.sin(floatPhase)) * 2);
    shadow.setAttribute('opacity', 0.8 - Math.abs(Math.sin(floatPhase)) * 0.2);

    const sp = svgPoint(mouse.x, mouse.y);
    moveEye(EYE_L, irisL, pupilL, sp.x, sp.y);
    moveEye(EYE_R, irisR, pupilR, sp.x, sp.y);

    rafId = requestAnimationFrame(render);
  }

  /* ── Mouse tracking ─────────────────────────────────── */
  document.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (mood === 'idle') applyMood('track');
    clearTimeout(window._mascotTrackTimer);
    window._mascotTrackTimer = setTimeout(() => {
      if (mood === 'track') applyMood('idle');
    }, 1500);
  });

  /* ── Sign-in button reactions ───────────────────────── */
  function attachButtonReactions() {
    const targets = [
      document.querySelector('.g_id_signin'),
      document.querySelector('.demo-btn'),
      document.getElementById('google-btn-container'),
    ].filter(Boolean);

    targets.forEach(el => {
      el.addEventListener('mouseenter', () => {
        applyMood('laugh');
        clearTimeout(window._mascotBtnTimer);
      });
      el.addEventListener('mouseleave', () => {
        window._mascotBtnTimer = setTimeout(() => applyMood('idle'), 800);
      });
      el.addEventListener('click', () => {
        applyMood('wonder');
      });
    });
  }

  /* ── Mascot click: wave/laugh ───────────────────────── */
  svg.style.cursor = 'pointer';
  svg.addEventListener('click', () => {
    applyMood('laugh');
    clearTimeout(window._mascotClickTimer);
    window._mascotClickTimer = setTimeout(() => applyMood('idle'), 1600);
  });

  /* ── Boot ───────────────────────────────────────────── */
  applyMood('idle');
  scheduleBlink();
  scheduleMoodCycle();
  render();

  // Attach button reactions after DOM is ready
  if (document.readyState === 'complete') {
    attachButtonReactions();
  } else {
    window.addEventListener('load', attachButtonReactions);
  }

  // Cleanup on screen switch
  window._mascotDestroy = function () {
    cancelAnimationFrame(rafId);
    clearTimeout(blinkTimer);
    clearTimeout(moodTimer);
  };
})();
