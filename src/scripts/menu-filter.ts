/** Chips, search, empire switch and "first time" for a [data-menu] block. Tiny on purpose (also used by /meni/). */
export function initMenu(root: HTMLElement) {
  const items = [...root.querySelectorAll<HTMLElement>('[data-mi]')];
  const cats = [...root.querySelectorAll<HTMLElement>('[data-menu-cat]')];
  const subs = [...root.querySelectorAll<HTMLElement>('[data-menu-sub]')];
  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-chip]')];
  const search = root.querySelector<HTMLInputElement>('[data-menu-search]');
  const empty = root.querySelector<HTMLElement>('[data-menu-empty]');
  let chip = 'all';
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj');

  function apply() {
    const q = search ? norm(search.value.trim()) : '';
    let shown = 0;
    for (const it of items) {
      const okChip = chip === 'all' || (it.dataset.chips || '').split(' ').includes(chip);
      const okQ = !q || norm(it.dataset.search || '').includes(q);
      it.hidden = !(okChip && okQ);
      if (!it.hidden) shown++;
    }
    for (const s of subs) s.hidden = !s.nextElementSibling || ![...s.nextElementSibling.querySelectorAll<HTMLElement>('[data-mi]')].some((i) => !i.hidden);
    for (const c of cats) c.hidden = ![...c.querySelectorAll<HTMLElement>('[data-mi]')].some((i) => !i.hidden);
    if (empty) empty.hidden = shown > 0;
  }

  const setChip = (id: string) => {
    chip = id;
    chips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.chip === id)));
    apply();
  };
  chips.forEach((b) => b.addEventListener('click', () => setChip(b.dataset.chip === chip ? 'all' : b.dataset.chip!)));
  search?.addEventListener('input', apply);
  document.addEventListener('k4l:filter', (e) => setChip((e as CustomEvent).detail));

  // Беч | Све | Цариград
  root.querySelectorAll<HTMLButtonElement>('[data-empire-set]').forEach((b) => b.addEventListener('click', () => {
    const v = b.dataset.empireSet!;
    root.dataset.empire = v;
    root.querySelectorAll('[data-empire-set]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));

  // Први пут код нас?
  root.querySelector('[data-first-btn]')?.addEventListener('click', () => {
    setChip('all');
    const firsts = items.filter((i) => i.hasAttribute('data-first'));
    firsts.forEach((i) => { i.classList.remove('is-first'); void i.offsetWidth; i.classList.add('is-first'); });
    firsts[0]?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  });

  // During a fast, open the menu with the fasting preset if asked via #posno
  if (location.hash === '#posno') setChip('posno');
  apply();
}
