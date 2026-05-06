import { moduleRegistry } from "../config/modules.js";

const BACK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>`;

export function createRouter(modules = moduleRegistry) {
  const pageMap = new Map(modules.filter((module) => module.enabled).map((module) => [module.route, module]));
  const defaultRoute = modules.find((module) => module.defaultRoute)?.route || "/dashboard";

  let contentNode;
  let headerNode;
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

  function renderPage(options = {}) {
    if (!contentNode) return;

    const activeRoute = normalizeHash(window.location.hash);
    const activeModule = pageMap.get(activeRoute) || pageMap.get(defaultRoute);

    if (!activeModule) return;

    contentNode.innerHTML = activeModule.render(getState());
    renderHeader();

    if (!options.preserveScroll) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  function mount(contentTarget, _navTarget, stateGetter = () => ({})) {
    contentNode = contentTarget;
    headerNode = document.querySelector("[data-app-header]");
    getState = stateGetter;

    if (!window.location.hash) {
      navigate(defaultRoute);
      return;
    }

    renderPage({ preserveScroll: false });
  }

  window.addEventListener("hashchange", () => renderPage({ preserveScroll: false }));

  return {
    mount,
    navigate,
    refresh: () => renderPage({ preserveScroll: true }),
  };
}
