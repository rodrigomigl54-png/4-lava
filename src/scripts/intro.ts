/**
 * Intro controller. html[data-intro="on"] is set before first paint (BaseLayout)
 * only on the homepage, on the first visit, and never for bots/?nointro.
 */
const KEY = 'k4l-intro-seen-v2'; // bump when the intro footage changes, so everyone sees the new one once
const HOLD_MS = 1000;

function remember() { try { localStorage.setItem(KEY, '1'); } catch {} }

function pickSrc(v: HTMLVideoElement) {
  const src = JSON.parse(v.dataset.src || 'null');
  if (!src) return;
  const s = matchMedia('(max-width: 47.99rem)').matches ? src.mobile : src.desktop;
  if (!matchMedia('(max-width: 47.99rem)').matches && v.dataset.posterDesktop) v.poster = v.dataset.posterDesktop;
  for (const [type, url] of [['video/webm', s.webm], ['video/mp4', s.mp4]] as const) {
    const el = document.createElement('source');
    el.type = type; el.src = url; v.appendChild(el);
  }
  v.load();
}

export function initIntro() {
  const html = document.documentElement;
  const root = document.querySelector<HTMLElement>('[data-intro]');
  if (!root || html.dataset.introMode !== 'on') { root?.remove(); return; }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fountain = root.querySelector<HTMLElement>('[data-scene="fountain"]')!;
  const door = root.querySelector<HTMLElement>('[data-scene="door"]')!;
  const sip = root.querySelector<HTMLButtonElement>('[data-intro-sip]')!;
  const welcome = root.querySelector<HTMLElement>('[data-intro-welcome]')!;
  const welcomeText = root.querySelector<HTMLElement>('[data-welcome-text]')!.textContent || '';
  const prevFocus = document.activeElement as HTMLElement | null;
  let done = false;

  // Videos load only after first paint
  requestAnimationFrame(() => setTimeout(() => {
    root.querySelectorAll<HTMLVideoElement>('video[data-src]').forEach(pickSrc);
    const fv = fountain.querySelector<HTMLVideoElement>('video:not([data-walk-video])');
    if (fv && !reduce) fv.play().catch(() => {});
  }, 50));

  // Several stills of the fountain → slow cross-fade sequence
  const stills = [...fountain.querySelectorAll<HTMLElement>('.intro__still')];
  let si = 0;
  const seq = !reduce && stills.length > 1 ? setInterval(() => {
    stills[si].classList.remove('is-on'); si = (si + 1) % stills.length; stills[si].classList.add('is-on');
  }, 2600) : 0;

  if (reduce) {
    sip.querySelector('[data-label-motion]')!.setAttribute('hidden', '');
    sip.querySelector('[data-label-reduced]')!.removeAttribute('hidden');
    root.querySelector('.intro__hint')?.setAttribute('hidden', '');
  }

  function close(focusMain = true) {
    if (done) return;
    done = true;
    remember();
    clearInterval(seq);
    document.removeEventListener('keydown', onKey, true);
    root!.classList.add('is-leaving');
    const finish = () => {
      root!.remove();
      delete html.dataset.introMode;
      document.dispatchEvent(new CustomEvent('k4l:intro-done'));
      if (focusMain) (document.getElementById('hero-title') || document.getElementById('main'))?.focus?.({ preventScroll: true });
      else prevFocus?.focus?.();
    };
    if (reduce) finish(); else setTimeout(finish, 750);
  }

  function enter() {
    if (done || root!.classList.contains('is-entering')) return;
    root!.classList.add('is-entering');
    if (reduce) { close(); return; }
    // One-shot walk from the fountain to the door: play it, glow at the door, reveal
    const walk = root!.querySelector<HTMLVideoElement>('[data-walk-video]');
    if (walk) {
      root!.classList.add('is-walking');
      let glowed = false, closed = false;
      const glow = () => {
        if (glowed) return; glowed = true;
        door.classList.add('is-active', 'is-open');
        welcome.textContent = welcomeText;
      };
      const finish = () => { if (closed) return; closed = true; glow(); setTimeout(() => close(), 250); };
      walk.addEventListener('ended', finish, { once: true });
      walk.currentTime = 0;
      walk.play().then(() => {
        const ms = Number.isFinite(walk.duration) ? walk.duration * 1000 : 3000;
        setTimeout(glow, Math.max(0, ms - 700));          // the door glows as we arrive
        setTimeout(finish, Math.min(ms + 150, 4200));     // safety net
      }).catch(finish);
      return;
    }
    // fountain → door: cross-fade + pan, the door frame glows, then reveal
    fountain.classList.add('is-past');
    fountain.classList.remove('is-active');
    door.classList.add('is-active');
    door.removeAttribute('aria-hidden');
    const dv = door.querySelector<HTMLVideoElement>('video');
    dv?.play().catch(() => {});
    setTimeout(() => { door.classList.add('is-open'); welcome.textContent = welcomeText; }, 700);
    setTimeout(() => close(), 2600);
  }

  // Hold (≈1 s) or tap: a tap starts the same 1-second fill, so it also works for touch & keyboard users
  let raf = 0, t0 = 0;
  const tick = (now: number) => {
    const p = Math.min(1, (now - t0) / HOLD_MS);
    sip.style.setProperty('--fill', String(1 - p));
    if (p < 1) raf = requestAnimationFrame(tick); else enter();
  };
  const start = () => {
    if (done || raf) return;
    if (reduce) { enter(); return; }
    sip.classList.add('is-holding');
    t0 = performance.now();
    raf = requestAnimationFrame(tick);
  };
  sip.addEventListener('pointerdown', start);
  sip.addEventListener('click', start);
  sip.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); start(); } });

  root.querySelector('[data-intro-skip]')!.addEventListener('click', () => close());
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    // keep focus inside the dialog
    if (e.key === 'Tab') {
      const f = [...root!.querySelectorAll<HTMLElement>('button:not([hidden])')];
      const i = f.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length]?.focus();
    }
  };
  document.addEventListener('keydown', onKey, true);
  sip.focus({ preventScroll: true });
}
