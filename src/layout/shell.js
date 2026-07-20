const NAV_ICONS = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/></svg>`,
  route: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="19" r="2.4"/><circle cx="18" cy="5" r="2.4"/><path d="M8.2 17.6c3.6-1.6 2.4-4.8 5.4-6.4 2.2-1.2 3.4-2.4 3.2-3.9"/></svg>`,
  gallery: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="9" cy="10.5" r="1.6"/><path d="m3.5 17.5 4.8-4.5 3.6 3.4 3.3-3 5.3 4.5"/></svg>`,
  live: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/><path d="M7.4 7.4a6.5 6.5 0 0 0 0 9.2"/><path d="M16.6 16.6a6.5 6.5 0 0 0 0-9.2"/><path d="M4.6 4.6a10.5 10.5 0 0 0 0 14.8"/><path d="M19.4 19.4a10.5 10.5 0 0 0 0-14.8"/></svg>`,
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
      <!--
        Rueckweg zur Live-Ansicht. Bewusst OHNE data-nav-route: der Router
        markiert darueber den aktiven Punkt, und das hier ist keine Seite
        dieser App, sondern der Ausgang. Liegt in der Shell statt in jeder
        Unterseite — so ist er ueberall da, wo die Nav ist.
      -->
      <a class="bottom-nav__item bottom-nav__item--live" href="../" aria-label="Zurueck zur Live-Ansicht">
        ${NAV_ICONS.live}
        <span>Live</span>
      </a>
    </nav>
    <dialog id="photo-lightbox" class="photo-lightbox">
      <button class="photo-lightbox__close" data-lightbox-close aria-label="Schließen">&#x2715;</button>
      <img class="photo-lightbox__img" src="" alt="" />
      <p class="photo-lightbox__caption"></p>
    </dialog>
  `;
}
