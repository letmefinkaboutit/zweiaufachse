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
  const { locationData, previousLocationData, geocodeData, locationLoading } = state;

  if (!locationData) {
    if (locationLoading) {
      return `
        <div class="dashboard-status-bar">
          <span class="status-chip status-chip--searching">
            <span class="status-chip__dot"></span>GPS wird gesucht
          </span>
        </div>
      `;
    }
    return "";
  }

  const { isMoving, speedKph } = computeMovementStatus(locationData, previousLocationData);

  const movementChip =
    isMoving === null
      ? `<span class="status-chip status-chip--unknown">Signal empfangen<span class="status-chip__ellipsis"><span>·</span><span>·</span><span>·</span></span></span>`
      : isMoving
        ? `<span class="status-chip status-chip--moving"><span class="status-chip__dot"></span>in Bewegung</span>`
        : `<span class="status-chip status-chip--still"><span class="status-chip__dot"></span>Nicht in Bewegung</span>`;

  const speedChip =
    isMoving && speedKph !== null
      ? `<span class="status-chip status-chip--meta">${speedKph.toFixed(0)} km/h</span>`
      : "";

  const pinIcon = `<svg class="status-chip__pin" viewBox="0 0 10 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M5 0C2.24 0 0 2.24 0 5c0 3.5 5 9 5 9s5-5.5 5-9c0-2.76-2.24-5-5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" fill="currentColor"/></svg>`;

  const locationChip = geocodeData?.locationLabel
    ? `<span class="status-chip status-chip--location">${pinIcon}${geocodeData.flag} ${geocodeData.locationLabel}${geocodeData.state ? `, ${geocodeData.state}` : ""}</span>`
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
    ? createRouteDashboardStatsTile(state.routeData, state.locationData, state.dailyStats)
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
        ${createJourneyTimelineCard(state.routeData, state.locationData, state.countrySegments, state.dailyStats)}
        ${routeMapTile}
        ${currentTile}
        ${forwardTile}
      </div>

      <div class="dashboard-sandbox-grid">
        ${routeStatsTile}
        ${createLocationDashboardTile(state.locationData, state)}
        ${dashboardHighlights.map((item) => createInfoCard(item)).join("")}
        ${sandboxModules.map((module) => createModuleTile(module)).join("")}
      </div>
    </div>
  `;
}
