/**
 * 3D bottle ring: slow auto-spin (paused on hover, focus, drag, off-screen or with
 * reduced motion), drag/swipe, arrows, keyboard, click-to-front, tabs filter wine/rakija
 * and switch the section's background theme.
 */
export function initRing(section: HTMLElement) {
  const ring = section.querySelector<HTMLElement>('[data-ring]');
  const track = section.querySelector<HTMLElement>('[data-ring-track]');
  if (!ring || !track) return;
  const items = [...track.querySelectorAll<HTMLElement>('[data-ring-item]')];
  const cards = [...section.querySelectorAll<HTMLElement>('[data-drink-card]')];
  const bgs = [...section.querySelectorAll<HTMLElement>('[data-drink-bg]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = items.slice();
  let rot = 0;           // degrees
  let step = 360;        // degrees between items
  let front = 0;
  let auto = !reduce, inView = false, hovering = false, dragging = false, lastT = 0, settleTimer = 0;

  // Bottles orbit on an ellipse but always face the viewer ("lazy Susan")
  let rx = 300, rz = 160;
  function layout() {
    const n = Math.max(visible.length, 1);
    step = 360 / n;
    const w = ring!.getBoundingClientRect().width;
    rx = Math.min(w * 0.4, 440);
    rz = Math.min(rx * 0.55, 220);
    paint();
  }

  function paint() {
    const n = visible.length;
    let best = 0, bestCos = -2;
    visible.forEach((it, k) => {
      const ang = (((k * step + rot) % 360) + 360) % 360;
      const rad = (ang * Math.PI) / 180;
      const c = Math.cos(rad), sn = Math.sin(rad);
      const depth = (c + 1) / 2; // 1 = front, 0 = back
      it.style.transform = `translate3d(${(sn * rx).toFixed(1)}px, ${(-(1 - depth) * 26).toFixed(1)}px, ${(c * rz).toFixed(1)}px) scale(${(0.62 + 0.38 * depth).toFixed(3)})`;
      it.style.opacity = String(0.3 + 0.7 * depth);
      it.style.filter = `brightness(${(0.5 + 0.5 * depth).toFixed(2)}) blur(${((1 - depth) * 1.2).toFixed(2)}px)`;
      it.style.zIndex = String(Math.round(c * 100) + 100);
      it.querySelector('button')!.tabIndex = -1;
      if (c > bestCos) { bestCos = c; best = k; }
    });
    if (n) setFront(best);
  }

  function setFront(k: number) {
    const it = visible[k];
    if (!it) return;
    items.forEach((x) => x.classList.toggle('is-front', x === it));
    it.querySelector('button')!.tabIndex = 0;
    const idx = Number(it.dataset.ringItem);
    if (idx !== front || !bgs.some((b) => b.classList.contains('is-on'))) {
      front = idx;
      cards.forEach((c) => (c.hidden = Number(c.dataset.drinkCard) !== idx));
      bgs.forEach((b) => b.classList.toggle('is-on', Number(b.dataset.drinkBg) === idx));
    }
  }

  // rotate so that visible[k] faces the viewer (shortest way)
  function goTo(k: number, smooth = true) {
    const target = -k * step;
    let delta = (((target - rot) % 360) + 540) % 360 - 180;
    animateTo(rot + delta, smooth);
  }
  function animateTo(to: number, smooth: boolean) {
    if (reduce || !smooth) { rot = to; paint(); return; }
    const from = rot, t0 = performance.now(), dur = 700;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      rot = from + (to - from) * e;
      paint();
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  const frontK = () => visible.findIndex((x) => x.classList.contains('is-front'));
  const nudge = (d: number) => { pause(); goTo((frontK() + d + visible.length) % visible.length); };

  function pause() { auto = false; clearTimeout(settleTimer); settleTimer = window.setTimeout(() => { auto = !reduce; }, 6000); }

  // auto spin
  const loop = (now: number) => {
    const dt = lastT ? Math.min(64, now - lastT) : 16;
    lastT = now;
    if (auto && inView && !hovering && !dragging && !document.hidden) { rot -= dt * 0.006; paint(); }
    requestAnimationFrame(loop);
  };
  if (!reduce) requestAnimationFrame(loop);
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { inView = e.isIntersecting; }).observe(ring);

  ring.addEventListener('pointerenter', () => { hovering = true; });
  ring.addEventListener('pointerleave', () => { hovering = false; });
  ring.addEventListener('focusin', () => { hovering = true; });
  ring.addEventListener('focusout', () => { hovering = false; });

  // drag / swipe
  let x0 = 0, r0 = 0, moved = false;
  ring.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('.ring__nav')) return;
    dragging = true; moved = false; x0 = e.clientX; r0 = rot; ring.classList.add('is-dragging');
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - x0;
    if (Math.abs(dx) > 4) moved = true;
    rot = r0 + dx * 0.35; paint();
  });
  window.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false; ring.classList.remove('is-dragging');
    if (moved) { pause(); goTo(frontK()); }
  });
  track.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ring-pick]');
    if (!b || moved) return;
    pause();
    goTo(visible.indexOf(b.closest('[data-ring-item]') as HTMLElement));
  });
  section.querySelectorAll<HTMLElement>('[data-ring-step]').forEach((b) => b.addEventListener('click', () => nudge(Number(b.dataset.ringStep))));
  ring.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); nudge(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-1); }
  });

  // tabs: all / wine / rakija — filter bottles + switch background theme
  section.querySelectorAll<HTMLButtonElement>('[data-cellar-tab]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.cellarTab!;
    section.querySelectorAll('[data-cellar-tab]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    section.dataset.theme = k;
    items.forEach((it) => (it.hidden = k !== 'all' && it.dataset.kind !== k));
    visible = items.filter((it) => !it.hidden);
    rot = 0;
    layout();
    goTo(0, false);
    pause();
  }));

  addEventListener('resize', layout);
  layout();
  goTo(0, false);
}
