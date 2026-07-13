// Verschlankt die grosse POI-Quelldatei auf die Felder, die die App nutzt.
//
// Aufruf (aus dem Projekt-Root):
//   node tools/build-poi-data.mjs
//
// Die Quelldatei bleibt als Editorial-/Planungsbasis im Repo; die App laedt
// nur noch das kompakte pois.min.json.

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = resolve(projectRoot, "src/poi/timo_tino_route_pois_scored_expanded_generator.json");
const outPath = resolve(projectRoot, "src/poi/pois.min.json");

const source = JSON.parse(readFileSync(srcPath, "utf8"));

const pois = (source.pois ?? []).map((poi) => ({
  id: poi.id,
  name: poi.name,
  country: poi.country,
  category: poi.category,
  subCategory: poi.subCategory ?? undefined,
  priority: poi.priority ?? undefined,
  curationLevel: poi.curationLevel ?? undefined,
  verificationStatus: poi.verificationStatus ?? undefined,
  needs_enrichment: poi.needs_enrichment ?? undefined,
  dataQuality: poi.dataQuality?.needsHumanReview != null
    ? { needsHumanReview: poi.dataQuality.needsHumanReview }
    : undefined,
  attractivenessScore: poi.attractivenessScore,
  scoreBand: poi.scoreBand ?? undefined,
  coordinates: poi.coordinates,
  routeContext: poi.routeContext
    ? {
        nearestRouteKmApprox: poi.routeContext.nearestRouteKmApprox,
        distanceFromRouteKmApprox: poi.routeContext.distanceFromRouteKmApprox,
        fit: poi.routeContext.fit,
      }
    : undefined,
  shortDescription: poi.shortDescription ?? undefined,
  whyItMattersForApp: poi.whyItMattersForApp ?? undefined,
}));

const output = {
  schemaVersion: source.schemaVersion,
  generatedFor: source.generatedFor,
  createdAt: source.createdAt,
  dataQualityWarning: source.dataQualityWarning,
  recommendedMvpFilters: source.recommendedMvpFilters,
  pois,
};

writeFileSync(outPath, JSON.stringify(output));

const inSize = statSync(srcPath).size;
const outSize = statSync(outPath).size;
console.log(`POIs:         ${pois.length}`);
console.log(`Dateigroesse: ${(inSize / 1e6).toFixed(2)} MB -> ${(outSize / 1e3).toFixed(0)} KB`);
console.log(`Geschrieben:  ${outPath}`);
