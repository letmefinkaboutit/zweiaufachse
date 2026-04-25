import { moduleRegistry } from "../config/modules.js";
import { dashboardHighlights, tripMeta } from "../data/mockData.js";
import { createInfoCard, createModuleTile } from "../components/cards.js";
import {
  createLocationDashboardTile,
  createRouteDashboardTile,
} from "../components/routeCards.js";
import { createCurrentAudienceTile, createForwardAudienceTile } from "../components/poiCards.js";
import { createAudiencePoiContext } from "../services/poiService.js";

function createPlaceholderTile(title, text, href = "#route", extraClass = "") {
  const classes = ["dashboard-focus-card", extraClass].filter(Boolean).join(" ");

  return `
    <a class="${classes}" href="${href}">
      <div class="dashboard-focus-card__header">
        <div>
          <p class="section-intro__eyebrow">Favorit</p>
          <h3>${title}</h3>
        </div>
      </div>
      <p class="muted-text">${text}</p>
    </a>
  `;
}

function createDashboardMasthead() {
  return `
    <section class="dashboard-masthead">
      <p class="section-intro__eyebrow">Start</p>
      <h1>${tripMeta.subtitle}</h1>
      <p class="dashboard-masthead__meta">${tripMeta.todayLabel} | Aktuell: ${tripMeta.currentLocation}</p>
      <p class="dashboard-masthead__text">${tripMeta.dailyBrief}</p>
    </section>
  `;
}

export function renderDashboardPage(state = {}) {
  const sandboxModules = moduleRegistry.filter(
    (module) => module.enabled && !["dashboard", "route"].includes(module.id),
  );
  const audienceContext = state.poiData?.pois?.length
    ? createAudiencePoiContext(state.poiData.pois, state.locationData)
    : null;

  const routeTile = state.routeData
    ? createRouteDashboardTile(state.routeData, state.locationData)
    : createPlaceholderTile(
        "Gesamtroute mit Live-Stand",
        state.routeLoading
          ? "Die Route wird gerade geladen und als Tourachse vorbereitet."
          : state.routeError || "Die Route ist gerade nicht verfuegbar.",
        "#route",
        "dashboard-focus-card--route",
      );

  const currentTile = audienceContext
    ? createCurrentAudienceTile(audienceContext)
    : createPlaceholderTile(
        "Was ist hier gerade spannend?",
        "Sobald Live-Position und POIs zusammenlaufen, erscheint hier der aktuelle Blick rund um den Standort.",
      );

  const forwardTile = audienceContext
    ? createForwardAudienceTile(audienceContext)
    : createPlaceholderTile(
        "Was kommt als Naechstes?",
        "Hier erscheinen gleich die naechsten 100 Kilometer und die groesseren Highlights weiter vorne.",
      );

  return `
    <div class="dashboard-page">
      ${createDashboardMasthead()}

      <section class="dashboard-section">
        <div class="dashboard-section__title">
          <p class="section-intro__eyebrow">Favoriten</p>
          <h2>Die wichtigsten Kacheln fuer den schnellen Blick</h2>
        </div>

        <div class="dashboard-main-grid">
          ${routeTile}
          ${currentTile}
          ${forwardTile}
        </div>
      </section>

      <section class="dashboard-section">
        <div class="dashboard-section__title">
          <p class="section-intro__eyebrow">Sandbox</p>
          <h2>Alles Weitere im Grid</h2>
        </div>

        <div class="dashboard-sandbox-grid">
          ${createLocationDashboardTile(state.locationData, state)}
          ${dashboardHighlights.map((item) => createInfoCard(item)).join("")}
          ${sandboxModules.map((module) => createModuleTile(module)).join("")}
        </div>
      </section>
    </div>
  `;
}
