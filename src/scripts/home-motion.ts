/**
 * Slow, "candle-light" motion for the homepage.
 * - Reveals: IntersectionObserver + CSS transitions (no library, cheap).
 * - GSAP + ScrollTrigger are loaded lazily, only when the timeline or a
 *   parallax element approaches the viewport.
 * Everything is skipped with prefers-reduced-motion (content is visible by default).
 */
export function initMotion() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

  // Reveals (only for elements below the fold at load)
  const reveals = [...document.querySelectorAll<HTMLElement>('[data-reveal]')].filter((el) => el.getBoundingClientRect().top > innerHeight * 0.9);
  const show = (el: HTMLElement) => el.classList.add('is-revealed');
  const io = new IntersectionObserver((entries) => {
    let i = 0;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target as HTMLElement;
      el.style.transitionDelay = `${Math.min(i++, 4) * 110}ms`;
      show(el);
      io.unobserve(el);
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  reveals.forEach((el) => {
    el.classList.add('will-reveal');
    el.addEventListener('focusin', () => show(el), { once: true });
    io.observe(el);
  });

  // Lazy GSAP for scrubbed effects
  const heavy = document.querySelectorAll<HTMLElement>('.tl__track, [data-parallax]');
  if (!heavy.length) return;
  let loaded = false;
  const lazy = new IntersectionObserver(async (entries) => {
    if (loaded || !entries.some((e) => e.isIntersecting)) return;
    loaded = true;
    lazy.disconnect();
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
    gsap.registerPlugin(ScrollTrigger);
    document.querySelectorAll<HTMLElement>('.tl__track').forEach((track) => {
      gsap.fromTo(track, { '--progress': 0 }, {
        '--progress': 1, ease: 'none',
        scrollTrigger: { trigger: track, start: 'top 80%', end: 'bottom 55%', scrub: 0.6 },
      });
    });
    gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
      const amt = Number(el.dataset.parallax || 40);
      gsap.fromTo(el, { y: -amt / 2 }, { y: amt / 2, ease: 'none', scrollTrigger: { trigger: el.parentElement!, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }, { rootMargin: '300px 0px' });
  heavy.forEach((el) => lazy.observe(el));
}
