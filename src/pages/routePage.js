import { tripMeta } from "../data/mockData.js";
import { createSectionIntro } from "../utils/format.js";
import {
  createElevationFigure,
  createLocationProviderCard,
  createRouteLoadingCard,
  createRouteMapFigure,
  createRouteMetricGrid,
  createRouteMilestones,
} from "../components/routeCards.js";
import { createPoiAudienceOverviewCard, createPoiFilterCard, createPoiJourneyCard, createPoiListCard, createPoiSummaryCard } from "../components/poiCards.js";
import { attachJourneyContextToPois, createAudiencePoiContext, createPoiMarkerSubset, filterPois, groupPoisByJourneyProgress } from "../services/poiService.js";

export function renderRoutePage(state = {}) {
  if (state.routeLoading) {
    return `
      <div class="page-stack">
        ${createSectionIntro(
          "Reiseverlauf",
          `Von ${tripMeta.start} bis ${tripMeta.destination}`,
          "Die Route wird gerade direkt aus der GPX-Datei gelesen und fuer die Darstellung vorbereitet.",
        )}
        ${createRouteLoadingCard("Die GPX-Daten werden analysiert.")}
      </div>
    `;
  }

  if (!state.routeData) {
    return `
      <div class="page-stack">
        ${createSectionIntro(
          "Reiseverlauf",
          `Von ${tripMeta.start} bis ${tripMeta.destination}`,
          "Die Routenansicht ist vorbereitet, aber die GPX-Datei konnte noch nicht sauber geladen werden.",
        )}
        ${createRouteLoadingCard(state.routeError || "Die Route ist derzeit nicht verfuegbar.")}
      </div>
    `;
  }

  const routeData = state.routeData;
  const visiblePois =
    state.poiData && !state.poiLoading
      ? filterPois(state.poiData.pois, state.poiFilters)
      : [];
  const journeyAwarePois = attachJourneyContextToPois(visiblePois, state.locationData);
  const audienceContext = state.poiData
    ? createAudiencePoiContext(state.poiData.pois, state.locationData)
    : { currentLead: null, currentArea: [], nextInteresting: [], macroHighlightsAhead: [] };
  const poiJourneyGroups = groupPoisByJourneyProgress(visiblePois, state.locationData);
  const poiMarkers = state.poiData ? createPoiMarkerSubset(visiblePois, 24, state.locationData) : [];
  const poiSection = state.poiLoading
    ? createRouteLoadingCard("Die POI-Daten werden analysiert und fuer das MVP gefiltert.")
    : state.poiData
      ? `
          ${createPoiAudienceOverviewCard(audienceContext, state.locationData)}
          ${createPoiSummaryCard(state.poiData, journeyAwarePois, poiJourneyGroups)}
          ${createPoiJourneyCard(poiJourneyGroups)}
          ${createPoiFilterCard(state.poiData, state.poiFilters)}
          ${createPoiListCard(journeyAwarePois)}
        `
      : createRouteLoadingCard(state.poiError || "Die POI-Daten sind derzeit nicht verfuegbar.");

  return `
    <div class="page-stack">
      ${createSectionIntro(
        "Reiseverlauf",
        `Von ${tripMeta.start} bis ${tripMeta.destination}`,
        "Die Routenansicht basiert jetzt auf der echten Komoot-GPX-Datei. Damit wird sie zum zentralen Bezugsrahmen fuer Fortschritt, Updates und spaetere Live-Daten.",
      )}

      ${createLocationProviderCard(state.locationData, state)}
      ${createRouteMapFigure(routeData, state.locationData, poiMarkers)}
      ${createRouteMetricGrid(routeData, state.locationData)}
      ${createElevationFigure(routeData)}
      ${createRouteMilestones(routeData)}
      ${poiSection}
    </div>
  `;
}
