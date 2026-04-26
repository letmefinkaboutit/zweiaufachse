import { moduleRegistry } from "../config/modules.js";
import { dashboardHighlights } from "../data/mockData.js";
import { createInfoCard, createModuleTile } from "../components/cards.js";
import {
  createLocationDashboardTile,
  createRouteDashboardMapTile,
  createRouteDashboardStatsTile,
} from "../components/routeCards.js";
import { createCurrentAudienceTile, createForwardAudienceTile } from "../components/poiCards.js";
import { createAudiencePoiContext } from "../services/poiService.js";
import { computeMovementStatus } from "../services/routePositionService.js";
import { createJourneyTimelineCard } from "../components/journeyTimeline.js";

function createStatusChipBar(state) {
  const { locationData, previousLocationData, geocodeData } = state;

  if (!locationData) {
    return "";
  }

  const { isMoving, speedKph } = computeMovementStatus(locationData, previousLocationData);

  const movementChip =
    isMoving === null
      ? `<span class="status-chip status-chip--unknown">Signal empfangen</span>`
      : isMoving
        ? `<span class="status-chip status-chip--moving"><span class="status-chip__dot"></span>in Bewegung</span>`
        : `<span class="status-chip status-chip--still"><span class="status-chip__dot"></span>Nicht in Bewegung</span>`;

  const speedChip =
    isMoving && speedKph !== null
      ? `<span class="status-chip status-chip--meta">${speedKph.toFixed(0)} km/h</span>`
      : "";

  const locationChip = geocodeData?.locationLabel
    ? `<span class="status-chip status-chip--location">${geocodeData.flag} ${geocodeData.locationLabel}${geocodeData.state ? `, ${geocodeData.state}` : ""}</span>`
    : "";

  return `
    <div class="dashboard-status-bar">
      ${movementChip}
      ${speedChip}
      ${locationChip}
    </div>
  `;
}

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

export function renderDashboardPage(state = {}) {
  const sandboxModules = moduleRegistry.filter(
    (module) => module.enabled && !["dashboard", "route"].includes(module.id),
  );
  const audienceContext = state.poiData?.pois?.length
    ? createAudiencePoiContext(state.poiData.pois, state.locationData)
    : null;

  const routeMapTile = state.routeData
    ? createRouteDashboardMapTile(state.routeData, state.locationData)
    : createPlaceholderTile(
        "Gesamtroute mit Live-Stand",
        state.routeLoading
          ? "Die Route wird gerade geladen und als Tourachse vorbereitet."
          : state.routeError || "Die Route ist gerade nicht verfuegbar.",
        "#route",
        "dashboard-focus-card--route-map",
      );

  const routeStatsTile = state.routeData
    ? createRouteDashboardStatsTile(state.routeData, state.locationData)
    : createPlaceholderTile(
        "Tourstatus in Zahlen",
        "Gesamtdistanz, geschafft, verbleibend und die letzten 24 Stunden erscheinen hier, sobald die Route bereit ist.",
        "#route",
        "dashboard-focus-card--route-stats",
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
      ${createStatusChipBar(state)}

      <div class="dashboard-main-grid">
        ${createJourneyTimelineCard(state.routeData, state.locationData, state.countrySegments)}
        ${routeMapTile}
        ${routeStatsTile}
        ${currentTile}
        ${forwardTile}
      </div>

      <div class="dashboard-sandbox-grid">
        ${createLocationDashboardTile(state.locationData, state)}
        ${dashboardHighlights.map((item) => createInfoCard(item)).join("")}
        ${sandboxModules.map((module) => createModuleTile(module)).join("")}
      </div>
    </div>
  `;
}
