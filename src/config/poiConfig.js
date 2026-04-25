export const poiConfig = {
  sourceFilePath: "./src/poi/timo_tino_route_pois_scored_expanded_generator.json",
  defaultFilters: {
    minScore: 0.65,
    category: "all",
    routeProximity: "on_route_or_very_close",
    highlightLevel: "highlights_only",
    includeNeedsEnrichment: false,
  },
  markerLimit: 24,
};
