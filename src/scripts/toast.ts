/** Accessible toast (aria-live region lives in BaseLayout). */
let timer: number | undefined;
export function toast(text: string, ms = 4200) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = '';
  // re-announce even if the same text repeats
  requestAnimationFrame(() => {
    el.textContent = text;
    el.classList.add('is-on');
    clearTimeout(timer);
    timer = window.setTimeout(() => el.classList.remove('is-on'), ms);
  });
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    ta.remove();
    return ok;
  }
}
