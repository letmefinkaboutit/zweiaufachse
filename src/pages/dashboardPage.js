import { createRouteDashboardMapTile } from "../components/routeCards.js";
import { createNearbyOverpassTile, createForwardRouteTile } from "../components/poiCards.js";
import { createAudiencePoiContext } from "../services/poiService.js";
import { computeMovementStatus } from "../services/routePositionService.js";
import { createJourneyTimelineCard } from "../components/journeyTimeline.js";

// Ab diesem Fix-Alter gilt das Signal als veraltet (Nacht, Funkloch, Akku leer).
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;
// Laenger als so stillgestanden = Pause (statt kurzem Halt an der Ampel).
const PAUSE_THRESHOLD_MS = 10 * 60 * 1000;

function formatFixAge(ms) {
  if (ms < 90_000) return "gerade eben";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `vor ${minutes} Min`;
  const hours = Math.round(ms / 3_600_000);
  if (hours < 48) return `vor ${hours} Std`;
  return `vor ${Math.round(hours / 24)} Tagen`;
}

// Nacht nach Uhrzeit des Betrachters — die Fahrer sind maximal eine Zeitzone
// entfernt, fuer die Schlaf-Anzeige reicht das.
function isNightTime() {
  const hour = new Date().getHours();
  return hour >= 21 || hour < 7;
}

function createMovementChip(isMoving, ageMs, lastMovementAt) {
  const isStale = ageMs !== null && ageMs > STALE_THRESHOLD_MS;

  if (isStale) {
    return `<span class="status-chip status-chip--unknown">📡 Signal veraltet</span>`;
  }

  if (isMoving) {
    return `<span class="status-chip status-chip--moving"><span class="status-chip__dot"></span>in Bewegung</span>`;
  }

  // isMoving === null mit altem Fix bedeutet: keine neuen Positionen mehr —
  // wie Stillstand behandeln statt ewig "Signal empfangen" zu blinken.
  const treatAsResting =
    isMoving === false || (isMoving === null && ageMs !== null && ageMs > PAUSE_THRESHOLD_MS);

  if (treatAsResting) {
    if (isNightTime()) {
      return `<span class="status-chip status-chip--still">🌙 Schläft</span>`;
    }

    const stoppedMs = lastMovementAt ? Date.now() - lastMovementAt : ageMs;
    if (stoppedMs === null || stoppedMs >= PAUSE_THRESHOLD_MS) {
      return `<span class="status-chip status-chip--still">☕ Pause</span>`;
    }

    return `<span class="status-chip status-chip--still"><span class="status-chip__dot"></span>Angehalten</span>`;
  }

  return `<span class="status-chip status-chip--unknown">Signal empfangen<span class="status-chip__ellipsis"><span>·</span><span>·</span><span>·</span></span></span>`;
}

function createStatusChipBar(state) {
  const { locationData, previousLocationData, geocodeData, locationLoading, lastMovementAt } = state;

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

  const fixTime = locationData.timestamp ? new Date(locationData.timestamp).getTime() : NaN;
  const ageMs = Number.isNaN(fixTime) ? null : Math.max(0, Date.now() - fixTime);

  const { isMoving, speedKph } = computeMovementStatus(locationData, previousLocationData);

  const movementChip = createMovementChip(isMoving, ageMs, lastMovementAt);

  const speedChip =
    isMoving && ageMs !== null && ageMs <= STALE_THRESHOLD_MS && speedKph !== null
      ? `<span class="status-chip status-chip--meta">${speedKph.toFixed(0)} km/h</span>`
      : "";

  const clockIcon = `<svg class="status-chip__pin" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><polyline points="8,4.5 8,8 10.4,9.8"/></svg>`;

  const freshnessChip =
    ageMs !== null
      ? `<span class="status-chip status-chip--meta">${clockIcon}${formatFixAge(ageMs)}</span>`
      : "";

  const pinIcon = `<svg class="status-chip__pin" viewBox="0 0 10 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M5 0C2.24 0 0 2.24 0 5c0 3.5 5 9 5 9s5-5.5 5-9c0-2.76-2.24-5-5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" fill="currentColor"/></svg>`;

  const locationChip = geocodeData?.locationLabel
    ? `<span class="status-chip status-chip--location">${pinIcon}${geocodeData.flag} ${geocodeData.locationLabel}${geocodeData.state ? `, ${geocodeData.state}` : ""}</span>`
    : "";

  return `
    <div class="dashboard-status-bar">
      ${movementChip}
      ${speedChip}
      ${freshnessChip}
      ${locationChip}
    </div>
  `;
}

function createPlaceholderTile(title, text, href = "#/route", extraClass = "") {
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
        "#/route",
        "dashboard-focus-card--route-map",
      );

  const currentTile = createNearbyOverpassTile(state.overpassPois, state.locationData, state.overpassUnavailable);

  const forwardTile = createForwardRouteTile(state.poiData, state.locationData, state.countrySegments, state.routeData, state.forwardLimit ?? 15);

  return `
    <div class="dashboard-page">
      ${createStatusChipBar(state)}

      <div class="dashboard-main-grid">
        ${createJourneyTimelineCard(state.routeData, state.locationData, state.countrySegments, state.dailyStats)}
        ${routeMapTile}
        <div id="photo-tile-slot"></div>
        ${currentTile}
        ${forwardTile}
      </div>
    </div>
  `;
}
