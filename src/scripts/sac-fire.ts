/**
 * Real-looking fire and steam around the photographed sač.
 * Two canvases sandwich the photo: flames/embers behind it, embers, coals, sparks
 * and heat glow in front, steam rising from the lid. Additive-blended soft sprites with
 * a temperature colour ramp (white-yellow → orange → deep red → smoke) and curl-like
 * turbulence give the flicker. Pauses off-screen and when the tab is hidden; reduced
 * motion draws one still frame.
 *
 * Geometry is in the photo's normalised coordinates (0–1 of the sač image box).
 */
type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; seed: number; kind: number };

const G = {
  baseY: 0.9,          // where the pan sits on the ember bed
  baseX0: 0.06, baseX1: 0.94,
  rimY: 0.47,          // the crenellated lid rim (coals sit here)
  rimX0: 0.1, rimX1: 0.9,
  handle: { x: 0.49, y: 0.09 },
};

function sprite(size: number, stops: [number, string][]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) r.addColorStop(o, col);
  g.fillStyle = r;
  g.fillRect(0, 0, size, size);
  return c;
}

// temperature ramp for flame particles, pre-rendered (index 0 = hottest)
function flameSprites() {
  const ramp = [
    [255, 226, 140], [255, 196, 90], [255, 160, 50], [250, 125, 30], [235, 90, 18],
    [205, 60, 12], [150, 35, 8], [90, 20, 6],
  ];
  return ramp.map(([r, g, b], i) => sprite(64, [
    [0, `rgba(${r},${g},${b},${0.7 - i * 0.06})`],
    [0.35, `rgba(${r},${g},${b},${0.45 - i * 0.04})`],
    [1, `rgba(${r},${g},${b},0)`],
  ]));
}

const noise = (x: number, y: number, t: number) =>
  Math.sin(x * 3.1 + t * 1.7) * 0.5 + Math.sin(y * 4.3 - t * 2.3 + x) * 0.35 + Math.sin((x + y) * 7.7 + t * 3.1) * 0.15;

export function initSacFire(root: HTMLElement) {
  const back = root.querySelector<HTMLCanvasElement>('[data-fire-back]')!;
  const front = root.querySelector<HTMLCanvasElement>('[data-fire-front]')!;
  const img = root.querySelector<HTMLImageElement>('[data-sac-img]')!;
  const heat = root.querySelector<HTMLElement>('[data-sac-heat]');
  const bctx = back.getContext('2d')!;
  const fctx = front.getContext('2d')!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const flames = flameSprites();
  const ember = sprite(48, [[0, 'rgba(255,240,190,1)'], [0.25, 'rgba(255,150,50,.9)'], [0.6, 'rgba(200,50,10,.35)'], [1, 'rgba(120,20,0,0)']]);
  const smoke = sprite(96, [[0, 'rgba(235,232,226,.10)'], [0.5, 'rgba(225,222,216,.045)'], [1, 'rgba(220,218,212,0)']]);
  const spark = sprite(12, [[0, 'rgba(255,245,200,1)'], [0.4, 'rgba(255,170,60,.8)'], [1, 'rgba(255,120,20,0)']]);

  let W = 0, H = 0, dpr = 1, box = { x: 0, y: 0, w: 1, h: 1 };
  const toPx = (nx: number, ny: number) => [box.x + nx * box.w, box.y + ny * box.h];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const r = root.getBoundingClientRect();
    W = r.width; H = r.height;
    for (const c of [back, front]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ir = img.getBoundingClientRect();
    box = { x: ir.left - r.left, y: ir.top - r.top, w: ir.width, h: ir.height };
  }

  // fixed coals: along the ember bed (front + back) and on the lid rim
  type Coal = { nx: number; ny: number; s: number; ph: number; front: boolean };
  const coals: Coal[] = [];
  for (let i = 0; i < 60; i++) {
    const t = Math.random();
    const nx = G.baseX0 - 0.06 + t * (G.baseX1 - G.baseX0 + 0.12);
    const arc = Math.sin(t * Math.PI);
    coals.push({ nx, ny: G.baseY + 0.05 + arc * 0.05 + (Math.random() - 0.5) * 0.08, s: 0.008 + Math.random() ** 2 * 0.05, ph: Math.random() * 6.28, front: true });
    coals.push({ nx: nx + (Math.random() - 0.5) * 0.03, ny: G.baseY - 0.01 - arc * 0.02, s: 0.03 + Math.random() * 0.025, ph: Math.random() * 6.28, front: false });
  }
  for (let i = 0; i < 0; i++) {            // (no coals on the lid: they read as a ring of fire)
    const t = i / 17;
    const nx = G.rimX0 + t * (G.rimX1 - G.rimX0);
    const ny = G.rimY - Math.sin(t * Math.PI) * 0.1 + (Math.random() - 0.5) * 0.02;
    coals.push({ nx, ny, s: 0.025 + Math.random() * 0.02, ph: Math.random() * 6.28, front: true });
  }

  const ps: P[] = [];
  const steam: P[] = [];
  const sparks: P[] = [];
  const spawnFlame = (lid: boolean) => {
    const back = Math.random() < 0.7;
    let nx: number, ny: number;
    if (lid) {
      const t = Math.random();
      nx = G.rimX0 + t * (G.rimX1 - G.rimX0);
      ny = G.rimY - Math.sin(t * Math.PI) * 0.1;
    } else {
      // more flames at the sides, where they lick up around the pan
      const side = Math.random();
      nx = side < 0.42 ? G.baseX0 + 0.02 + Math.random() * 0.16 : side < 0.84 ? G.baseX1 - 0.02 - Math.random() * 0.16 : 0.2 + Math.random() * 0.6;
      ny = G.baseY + 0.02 + Math.random() * 0.05;
    }
    const low = !lid && Math.random() < 0.22;
    ps.push({ x: nx, y: ny, vx: (Math.random() - 0.5) * 0.02 + (nx < 0.5 ? -0.012 : 0.012), vy: -(0.22 + Math.random() * 0.3) * (lid ? 0.55 : 1),
      life: 0, max: 0.5 + Math.random() * 0.6, size: 0.07 + Math.random() * 0.1, seed: Math.random() * 100, kind: low ? 1 : 0, ...(low ? { max: 0.18 + Math.random() * 0.18, size: 0.04 + Math.random() * 0.04, y: G.baseY + 0.07 + Math.random() * 0.03 } : {}) });
  };
  const spawnSteam = () => steam.push({ x: G.handle.x + (Math.random() - 0.5) * 0.08, y: G.handle.y - 0.02, vx: (Math.random() - 0.5) * 0.02, vy: -(0.09 + Math.random() * 0.06),
    life: 0, max: 2.6 + Math.random() * 2, size: 0.05 + Math.random() * 0.04, seed: Math.random() * 100, kind: 0 });
  const spawnSpark = () => sparks.push({ x: G.baseX0 + Math.random() * (G.baseX1 - G.baseX0), y: G.baseY + 0.04, vx: (Math.random() - 0.5) * 0.12, vy: -(0.4 + Math.random() * 0.5),
    life: 0, max: 0.6 + Math.random() * 0.9, size: 0.006 + Math.random() * 0.006, seed: Math.random() * 100, kind: 0 });

  let t = 0, last = 0, raf = 0, running = false, accF = 0, accS = 0, accK = 0;

  function step(dt: number) {
    t += dt;
    accF += dt * 170; accS += dt * 14; accK += dt * 7;
    while (accF > 1) { accF--; spawnFlame(false); }
    while (accS > 1) { accS--; spawnSteam(); }
    while (accK > 1) { accK--; spawnSpark(); }
    for (const p of ps) {
      p.life += dt;
      const turb = noise(p.x * 6, p.y * 6, t + p.seed);
      p.vx += turb * 0.05 * dt;
      p.vx *= 0.98;
      p.vy -= 0.12 * dt;                         // buoyancy
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (const p of steam) {
      p.life += dt;
      p.vx += noise(p.x * 3, p.y * 3, t * 0.5 + p.seed) * 0.02 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy *= 0.995;
    }
    for (const p of sparks) {
      p.life += dt;
      p.vx += noise(p.x * 9, p.y * 9, t + p.seed) * 0.4 * dt;
      p.vy += 0.15 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (const arr of [ps, steam, sparks]) for (let i = arr.length - 1; i >= 0; i--) if (arr[i].life > arr[i].max) arr.splice(i, 1);
  }

  function drawCoals(ctx: CanvasRenderingContext2D, frontLayer: boolean) {
    for (const c of coals) {
      if (c.front !== frontLayer) continue;
      const fl = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(t * (2.3 + c.ph) + c.ph)) * (0.7 + 0.3 * Math.sin(t * 7.1 + c.ph * 3));
      const [x, y] = toPx(c.nx, c.ny);
      const s = c.s * box.w * (1.2 + fl * 0.8);
      ctx.globalAlpha = fl * (0.45 + c.s * 10);
      ctx.drawImage(ember, x - s / 2, y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  function drawFlames(ctx: CanvasRenderingContext2D, kind: number) {
    for (const p of ps) {
      if (p.kind !== kind) continue;
      const k = p.life / p.max;
      const idx = Math.min(flames.length - 1, Math.floor(k * flames.length * 1.05));
      const [x, y] = toPx(p.x, p.y);
      const s = p.size * box.w * (1 - k * 0.6) * (1 + 0.18 * Math.sin(t * 11 + p.seed));
      ctx.globalAlpha = Math.min(1, (1 - k) * 1.6) * (k < 0.08 ? k / 0.08 : 1);
      // stretched vertically: flame tongues
      const st = 1.8 + k * 1.4;                     // tongues stretch as they rise
      ctx.drawImage(flames[idx], x - s / 2, y - s * st * 0.6, s, s * st);
    }
    ctx.globalAlpha = 1;
  }

  function frame() {
    bctx.clearRect(0, 0, W, H);
    fctx.clearRect(0, 0, W, H);

    // back layer: glow of the fire bed + flames behind the pan
    const [gx, gy] = toPx(0.5, G.baseY + 0.06);
    const flick = 0.85 + 0.15 * Math.sin(t * 9.3) * Math.sin(t * 3.7 + 1);
    const glow = bctx.createRadialGradient(gx, gy, 0, gx, gy, box.w * 0.75);
    glow.addColorStop(0, `rgba(255,140,40,${0.55 * flick})`);
    glow.addColorStop(0.35, `rgba(200,60,10,${0.28 * flick})`);
    glow.addColorStop(1, 'rgba(120,20,0,0)');
    bctx.globalCompositeOperation = 'source-over';
    bctx.fillStyle = glow;
    bctx.fillRect(0, 0, W, H);
    bctx.globalCompositeOperation = 'lighter';
    drawCoals(bctx, false);
    drawFlames(bctx, 0);

    // front layer: ember bed, coals on the lid, small flames, sparks, steam
    fctx.globalCompositeOperation = 'lighter';
    {
      const [bx, by] = toPx(0.5, G.baseY + 0.08);
      fctx.save();
      fctx.translate(bx, by);
      fctx.scale(1, 0.16);
      const bed = fctx.createRadialGradient(0, 0, 0, 0, 0, box.w * 0.5);
      bed.addColorStop(0, `rgba(255,170,70,${0.55 * flick})`);
      bed.addColorStop(0.55, `rgba(220,80,20,${0.35 * flick})`);
      bed.addColorStop(1, 'rgba(120,20,0,0)');
      fctx.fillStyle = bed;
      fctx.beginPath(); fctx.arc(0, 0, box.w * 0.5, 0, Math.PI * 2); fctx.fill();
      fctx.restore();
    }
    drawCoals(fctx, true);
    drawFlames(fctx, 1);
    for (const p of sparks) {
      const [x, y] = toPx(p.x, p.y);
      const s = Math.max(2, p.size * box.w * 3);
      fctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      fctx.drawImage(spark, x - s / 2, y - s / 2, s, s);
    }
    fctx.globalAlpha = 1;
    fctx.globalCompositeOperation = 'source-over';
    for (const p of steam) {
      const k = p.life / p.max;
      const [x, y] = toPx(p.x, p.y);
      const s = p.size * box.w * (1 + k * 3.2);
      fctx.globalAlpha = Math.sin(Math.PI * Math.min(1, k * 1.1)) * 0.9;
      fctx.drawImage(smoke, x - s * 0.35, y - s, s * 0.7, s * 1.6);   // tall, thin wisps
    }
    fctx.globalAlpha = 1;
    if (heat) heat.style.opacity = String(0.75 + 0.25 * flick);
  }

  function loop(now: number) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    step(dt);
    frame();
    raf = running ? requestAnimationFrame(loop) : 0;
  }
  const start = () => { if (running || reduce) return; running = true; last = 0; raf = requestAnimationFrame(loop); };
  const stop = () => { running = false; cancelAnimationFrame(raf); raf = 0; };

  const ready = () => {
    resize();
    // warm up so the fire is already burning on the first visible frame
    for (let i = 0; i < 90; i++) step(1 / 30);
    frame();
    if (!reduce && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? start() : stop()), { rootMargin: '100px' }).observe(root);
      document.addEventListener('visibilitychange', () => (document.hidden ? stop() : root.getBoundingClientRect().top < innerHeight && start()));
    }
  };
  if (img.complete && img.naturalWidth) ready(); else img.addEventListener('load', ready, { once: true });
  addEventListener('resize', () => { resize(); frame(); });
}
