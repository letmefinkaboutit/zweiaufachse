import { moduleRegistry } from "../config/modules.js";

const BACK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>`;

export function createRouter(modules = moduleRegistry) {
  const pageMap = new Map(modules.filter((module) => module.enabled).map((module) => [module.route, module]));
  const defaultRoute = modules.find((module) => module.defaultRoute)?.route || "/dashboard";

  let contentNode;
  let headerNode;
  let navNode;
  let getState = () => ({});

  function normalizeHash(hash) {
    if (!hash || hash === "#") {
      return defaultRoute;
    }
    return hash.replace(/^#/, "");
  }

  function navigate(route) {
    const targetRoute = pageMap.has(route) ? route : defaultRoute;
    window.location.hash = targetRoute;
  }

  function renderHeader() {
    if (!headerNode) return;
    const activeRoute = normalizeHash(window.location.hash);
    if (activeRoute === defaultRoute) {
      headerNode.hidden = true;
      headerNode.innerHTML = "";
      return;
    }
    const module = pageMap.get(activeRoute);
    headerNode.hidden = false;
    headerNode.innerHTML = `
      <a class="page-header__back" href="#${defaultRoute}" aria-label="Zurück zur Startseite">
        ${BACK_ICON}
        Start
      </a>
      <span class="page-header__title">${module?.navLabel ?? ""}</span>
    `;
  }

  function renderNav() {
    if (!navNode) return;
    const activeRoute = normalizeHash(window.location.hash);
    const resolvedRoute = pageMap.has(activeRoute) ? activeRoute : defaultRoute;

    navNode.querySelectorAll("[data-nav-route]").forEach((item) => {
      const isActive = item.dataset.navRoute === resolvedRoute;
      item.classList.toggle("bottom-nav__item--active", isActive);
      if (isActive) {
        item.setAttribute("aria-current", "page");
      } else {
        item.removeAttribute("aria-current");
      }
    });
  }

  function renderPage(options = {}) {
    if (!contentNode) return;

    const activeRoute = normalizeHash(window.location.hash);
    const activeModule = pageMap.get(activeRoute) || pageMap.get(defaultRoute);

    if (!activeModule) return;

    const applyRender = () => {
      contentNode.innerHTML = activeModule.render(getState());
      renderHeader();
      renderNav();

      if (!options.preserveScroll) {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    };

    // Weicher Uebergang nur beim Seitenwechsel — nicht bei den haeufigen
    // Live-Refreshes, die wuerden sonst dauernd flackern.
    if (options.viewTransition && typeof document.startViewTransition === "function") {
      document.startViewTransition(applyRender);
    } else {
      applyRender();
    }
  }

  function mount(contentTarget, navTarget, stateGetter = () => ({})) {
    contentNode = contentTarget;
    headerNode = document.querySelector("[data-app-header]");
    navNode = navTarget;
    getState = stateGetter;

    if (!window.location.hash) {
      navigate(defaultRoute);
      return;
    }

    renderPage({ preserveScroll: false });
  }

  window.addEventListener("hashchange", () => renderPage({ preserveScroll: false, viewTransition: true }));

  return {
    mount,
    navigate,
    refresh: () => renderPage({ preserveScroll: true }),
  };
}
