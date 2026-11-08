/**
 * Slow, "candle-light" motion for the homepage. Loaded after first paint;
 * skipped entirely with prefers-reduced-motion (content is visible by default).
 */
export async function initMotion() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap.registerPlugin(ScrollTrigger);

  // Gentle reveals
  const reveals = gsap.utils.toArray<HTMLElement>('[data-reveal]').filter((el) => el.getBoundingClientRect().top > innerHeight * 0.9);
  gsap.set(reveals, { opacity: 0, y: 28 });
  // keyboard users: anything that receives focus is shown immediately
  reveals.forEach((el) => el.addEventListener('focusin', () => gsap.to(el, { opacity: 1, y: 0, duration: 0.3 }), { once: true }));
  ScrollTrigger.batch(reveals, {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out', stagger: 0.12 }),
  });

  // Timeline: the gold line draws itself while scrolling
  document.querySelectorAll<HTMLElement>('.tl__track').forEach((track) => {
    gsap.fromTo(track, { '--progress': 0 }, {
      '--progress': 1, ease: 'none',
      scrollTrigger: { trigger: track, start: 'top 80%', end: 'bottom 55%', scrub: 0.6 },
    });
    gsap.from(track.querySelectorAll('[data-tl-item]'), {
      opacity: 0, y: 20, duration: 1, ease: 'power2.out', stagger: 0.18,
      scrollTrigger: { trigger: track, start: 'top 80%', once: true },
    });
  });

  // Slight parallax on decorative lions
  gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
    const amt = Number(el.dataset.parallax || 40);
    gsap.fromTo(el, { y: -amt / 2 }, { y: amt / 2, ease: 'none', scrollTrigger: { trigger: el.parentElement!, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}
