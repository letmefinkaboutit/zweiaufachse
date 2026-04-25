import { moduleRegistry, navigationModules } from "../config/modules.js";

export function createRouter(modules = moduleRegistry) {
  const pageMap = new Map(modules.filter((module) => module.enabled).map((module) => [module.route, module]));
  const defaultRoute = modules.find((module) => module.defaultRoute)?.route || "/dashboard";

  let contentNode;
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

  function renderNavigation() {
    if (!navNode) {
      return;
    }

    const activeRoute = normalizeHash(window.location.hash);

    navNode.innerHTML = navigationModules
      .filter((module) => module.enabled)
      .map(
        (module) => `
          <a
            class="bottom-nav__link ${activeRoute === module.route ? "is-active" : ""}"
            href="#${module.route}"
            aria-current="${activeRoute === module.route ? "page" : "false"}"
          >
            <span class="bottom-nav__eyebrow">${module.shortLabel}</span>
            <span class="bottom-nav__label">${module.navLabel}</span>
          </a>
        `,
      )
      .join("");
  }

  function renderPage(options = {}) {
    if (!contentNode) {
      return;
    }

    const activeRoute = normalizeHash(window.location.hash);
    const activeModule = pageMap.get(activeRoute) || pageMap.get(defaultRoute);

    if (!activeModule) {
      return;
    }

    contentNode.innerHTML = activeModule.render(getState());
    renderNavigation();

    if (!options.preserveScroll) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  function mount(contentTarget, navTarget, stateGetter = () => ({})) {
    contentNode = contentTarget;
    navNode = navTarget;
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
