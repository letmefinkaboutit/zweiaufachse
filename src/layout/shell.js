const NAV_ICONS = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/></svg>`,
  route: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="19" r="2.4"/><circle cx="18" cy="5" r="2.4"/><path d="M8.2 17.6c3.6-1.6 2.4-4.8 5.4-6.4 2.2-1.2 3.4-2.4 3.2-3.9"/></svg>`,
  gallery: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="9" cy="10.5" r="1.6"/><path d="m3.5 17.5 4.8-4.5 3.6 3.4 3.3-3 5.3 4.5"/></svg>`,
};

const NAV_ITEMS = [
  { route: "/dashboard", label: "Start", icon: NAV_ICONS.dashboard },
  { route: "/route", label: "Route", icon: NAV_ICONS.route },
  { route: "/gallery", label: "Fotos", icon: NAV_ICONS.gallery },
];

export function createShell() {
  const navItems = NAV_ITEMS.map(
    (item) => `
      <a class="bottom-nav__item" href="#${item.route}" data-nav-route="${item.route}">
        ${item.icon}
        <span>${item.label}</span>
      </a>
    `,
  ).join("");

  return `
    <div class="app-shell">
      <div class="page-header" data-app-header hidden></div>
      <main class="app-main" data-app-content></main>
    </div>
    <nav class="bottom-nav" data-app-nav aria-label="Hauptnavigation">
      ${navItems}
    </nav>
    <dialog id="photo-lightbox" class="photo-lightbox">
      <button class="photo-lightbox__close" data-lightbox-close aria-label="Schließen">&#x2715;</button>
      <img class="photo-lightbox__img" src="" alt="" />
      <p class="photo-lightbox__caption"></p>
    </dialog>
  `;
}
