/**
 * app.js — Authentication flow & dashboard logic for KIT
 *
 * Google OAuth:
 *   Replace YOUR_GOOGLE_CLIENT_ID in index.html with a real
 *   OAuth 2.0 client ID from https://console.developers.google.com/
 *   Add your domain to the Authorised JS origins.
 *
 * The demo login bypasses Google and uses a placeholder user.
 */

'use strict';

/* ── Helpers ─────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    if (s.id === id) {
      s.classList.remove('exit');
      s.classList.add('active');
    } else {
      s.classList.remove('active');
      s.classList.add('exit');
    }
  });

  // Show/hide dashboard background canvas
  const dashCanvas = document.getElementById('dash-canvas');
  if (dashCanvas) {
    dashCanvas.style.display = (id === 'main-screen') ? 'block' : 'none';
  }
}

function toast(msg, duration = 3000) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), duration);
}

/* ── Session ─────────────────────────────────────────── */
let currentUser = null;

function setUser(user) {
  currentUser = user;

  // Update nav avatar & name
  const avatar = document.getElementById('user-avatar');
  const name   = document.getElementById('user-name');
  if (avatar) {
    avatar.src = user.picture || '';
    avatar.style.display = user.picture ? 'block' : 'none';
  }
  if (name) name.textContent = user.name || user.email || 'User';
}

function logout() {
  currentUser = null;

  // Revoke Google session if available
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }

  toast('You have been signed out.');
  setTimeout(() => showScreen('login-screen'), 600);
}

/* ── Google OAuth callback ───────────────────────────── */
function handleGoogleLogin(response) {
  try {
    // Decode the JWT credential (no verification needed client-side)
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    setUser({
      name:    payload.name,
      email:   payload.email,
      picture: payload.picture,
      sub:     payload.sub,
    });
    showScreen('main-screen');
    toast(`Welcome, ${payload.given_name || payload.name}!`);
  } catch (e) {
    console.error('Google login decode error:', e);
    toast('Sign-in failed. Please try again.');
  }
}

/* ── Demo login ──────────────────────────────────────── */
function loginDemo() {
  setUser({
    name:    'Demo User',
    email:   'demo@kit.dev',
    picture: '',
  });
  showScreen('main-screen');
  toast('Welcome! Running in demo mode.');
}

/* ── Dashboard background mini-particles ─────────────── */
(function initDashParticles() {
  // Only runs after main-screen becomes visible
  const observer = new MutationObserver(() => {
    const mainScreen = document.getElementById('main-screen');
    if (!mainScreen.classList.contains('active')) return;

    let canvas = document.getElementById('dash-canvas');
    if (canvas._init) return;
    canvas._init = true;

    const ctx = canvas.getContext('2d');
    const particles = [];
    const COUNT = 90;

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x:  Math.random() * window.innerWidth,
        y:  Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r:  Math.random() * 1.4 + 0.3,
        a:  Math.random() * 0.5 + 0.1,
      });
    }

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width, H = canvas.height;

      // Draw connections
      for (let i = 0; i < COUNT; i++) {
        for (let j = i + 1; j < COUNT; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(255,215,0,${0.06 * (1 - dist / 130)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // Draw & move particles
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,215,0,${p.a})`;
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
      }

      requestAnimationFrame(frame);
    }

    frame();
  });

  observer.observe(document.getElementById('main-screen'), {
    attributes: true, attributeFilter: ['class'],
  });
})();

/* ── Simulator navigation ───────────────────────────── */
function openSimulator() {
  showScreen('simulator-screen');
  toast('Power System Simulator loaded.');
  if (window.initSimulator) window.initSimulator();
}

function closeSimulator() {
  showScreen('main-screen');
}

/* ── Keyboard shortcut ───────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('main-screen').classList.contains('active')) {
    logout();
  }
});
