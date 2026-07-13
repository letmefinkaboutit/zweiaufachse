// Zaehlt Zahlen beim ersten Erscheinen hoch (Dashboard-Hero).
// Elemente markieren sich per data-counted selbst, damit jede Zahl nur
// einmal animiert — die Live-Refreshes rendern danach statische Werte.
export function mountCountUpObserver() {
  const animate = (el) => {
    el.dataset.counted = "true";

    const target = Number(el.dataset.countup);
    if (!Number.isFinite(target)) return;

    const suffix = el.dataset.countupSuffix ?? "";

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = `${target}${suffix}`;
      return;
    }

    const duration = 900;
    const startTime = performance.now();

    const step = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - (1 - t) ** 3;
      el.textContent = `${Math.round(target * eased)}${suffix}`;
      if (t < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  };

  const observer = new MutationObserver(() => {
    document.querySelectorAll("[data-countup]:not([data-counted])").forEach(animate);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
