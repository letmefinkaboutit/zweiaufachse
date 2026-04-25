import { poiConfig } from "../config/poiConfig.js";

function inferHighlightLevel(score) {
  if (score >= 0.9) {
    return "world_class";
  }

  if (score >= 0.75) {
    return "top_highlight";
  }

  if (score >= 0.55) {
    return "strong_candidate";
  }

  if (score >= 0.35) {
    return "nice_context";
  }

  return "micro";
}

function deriveViewerCategory(poi) {
  const category = poi.category || "";
  const subCategory = poi.subCategory || "";
  const name = poi.name || "";

  if (category.includes("national") || category.includes("unesco_nature")) {
    return "Nationalpark";
  }

  if (name.includes("Pass") || category.includes("mountain_pass")) {
    return "Aussichtspunkt";
  }

  if (category.includes("capital") || category.includes("city") || category.includes("town")) {
    return poi.score >= 0.6 ? "Highlight-Stadt" : "Etappenort";
  }

  if (category.includes("unesco") || category.includes("landmark") || category.includes("fortress")) {
    return "Sehenswuerdigkeit";
  }

  if (category.includes("lake") || category.includes("nature") || subCategory.includes("viewpoint")) {
    return poi.score >= 0.55 ? "Naturhighlight" : "Lokales Highlight";
  }

  if (subCategory.includes("food") || subCategory.includes("water") || category.includes("fun_stop")) {
    return "Lokales Highlight";
  }

  if (category.includes("route_micro_poi")) {
    return "Streckenmoment";
  }

  return poi.score >= 0.55 ? "Highlight" : "Lokales Highlight";
}

function normalizePoi(poi) {
  const verificationStatus = poi.verificationStatus || "unknown";
  const curationLevel = poi.curationLevel || "unknown";
  const needsEnrichment =
    verificationStatus.includes("needs_enrichment") || Boolean(poi.needs_enrichment);

  const normalizedPoi = {
    id: poi.id,
    name: poi.name,
    country: poi.country,
    category: poi.category,
    subCategory: poi.subCategory || null,
    priority: poi.priority || "low",
    curationLevel,
    verificationStatus,
    needsEnrichment,
    needsHumanReview: Boolean(poi.dataQuality?.needsHumanReview),
    score: poi.attractivenessScore || 0,
    scoreBand: poi.scoreBand || "unknown",
    highlightLevel: inferHighlightLevel(poi.attractivenessScore || 0),
    latitude: poi.coordinates?.lat ?? null,
    longitude: poi.coordinates?.lng ?? null,
    routeKm: poi.routeContext?.nearestRouteKmApprox ?? null,
    distanceFromRouteKm: poi.routeContext?.distanceFromRouteKmApprox ?? null,
    routeFit: poi.routeContext?.fit || "unknown",
    shortDescription: poi.shortDescription || "",
    whyItMattersForApp: poi.whyItMattersForApp || "",
    suggestedAppUsage: poi.suggestedAppUsage || [],
    links: poi.links || {},
    contentIdeas: poi.contentIdeas || {},
    scoreBreakdown: poi.scoreBreakdown || {},
    raw: poi,
  };

  return {
    ...normalizedPoi,
    viewerCategory: deriveViewerCategory(normalizedPoi),
  };
}

function sortPois(pois) {
  return [...pois].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return (left.routeKm ?? Number.POSITIVE_INFINITY) - (right.routeKm ?? Number.POSITIVE_INFINITY);
  });
}

function summarizePois(pois) {
  const categories = Array.from(new Set(pois.map((poi) => poi.category))).sort((left, right) =>
    left.localeCompare(right),
  );

  return {
    total: pois.length,
    curatedSeedCount: pois.filter((poi) => poi.curationLevel === "curated_seed").length,
    routeAnchorCount: pois.filter((poi) => poi.curationLevel === "auto_generated_route_anchor").length,
    needsEnrichmentCount: pois.filter((poi) => poi.needsEnrichment).length,
    categories,
    scoreThresholdCounts: {
      above035: pois.filter((poi) => poi.score >= 0.35).length,
      above055: pois.filter((poi) => poi.score >= 0.55).length,
      above065: pois.filter((poi) => poi.score >= 0.65).length,
      above075: pois.filter((poi) => poi.score >= 0.75).length,
    },
  };
}

export async function loadPoiData() {
  const response = await fetch(encodeURI(poiConfig.sourceFilePath));

  if (!response.ok) {
    throw new Error(`Die POI-Datei konnte nicht geladen werden (${response.status}).`);
  }

  const json = await response.json();
  const pois = sortPois((json.pois || []).map(normalizePoi));

  return {
    meta: {
      schemaVersion: json.schemaVersion,
      generatedFor: json.generatedFor,
      createdAt: json.createdAt,
      designIntent: json.designIntent,
      sourceGpx: json.sourceGpx,
      scoringModel: json.scoringModel,
      recommendedMvpFilters: json.recommendedMvpFilters,
      routeSegments: json.routeSegments || [],
      researchSources: json.researchSources || [],
      dataQualityWarning: json.dataQualityWarning,
      codeAgentGeneratorPrompt: json.codeAgentGeneratorPrompt,
    },
    pois,
    summary: summarizePois(pois),
  };
}

export function createDefaultPoiFilters() {
  return { ...poiConfig.defaultFilters };
}

export function filterPois(pois, filters) {
  return pois.filter((poi) => {
    if (poi.score < filters.minScore) {
      return false;
    }

    if (filters.category !== "all" && poi.category !== filters.category) {
      return false;
    }

    if (filters.routeProximity !== "all" && poi.routeFit !== filters.routeProximity) {
      return false;
    }

    if (!filters.includeNeedsEnrichment && poi.needsEnrichment) {
      return false;
    }

    if (filters.highlightLevel === "highlights_only" && poi.score < 0.65) {
      return false;
    }

    if (filters.highlightLevel === "strong_candidate_plus" && poi.score < 0.55) {
      return false;
    }

    if (filters.highlightLevel === "context_plus" && poi.score < 0.35) {
      return false;
    }

    return true;
  });
}

function sortByRouteKmThenScore(pois) {
  return [...pois].sort((left, right) => {
    const leftKm = left.routeKm ?? Number.POSITIVE_INFINITY;
    const rightKm = right.routeKm ?? Number.POSITIVE_INFINITY;

    if (leftKm !== rightKm) {
      return leftKm - rightKm;
    }

    return right.score - left.score;
  });
}

function createRelativeLabel(relativeKm) {
  const absoluteKm = Math.abs(relativeKm);
  const roundedKm = absoluteKm < 10 ? absoluteKm.toFixed(1) : absoluteKm.toFixed(0);

  if (absoluteKm <= 3) {
    return "direkt im aktuellen Bereich";
  }

  if (relativeKm > 0) {
    return `in ${roundedKm} km`;
  }

  return `vor ${roundedKm} km`;
}

export function attachJourneyContextToPois(visiblePois, locationData) {
  const currentKm = locationData?.routeMatch?.distanceDoneKm;

  if (typeof currentKm !== "number") {
    return sortByRouteKmThenScore(visiblePois).map((poi) => ({
      ...poi,
      relativeToLiveKm: null,
      relativeToLiveLabel: "noch ohne Live-Bezug",
      journeyRelation: "unknown",
    }));
  }

  return sortByRouteKmThenScore(visiblePois).map((poi) => {
    const relativeKm = typeof poi.routeKm === "number" ? poi.routeKm - currentKm : null;
    let journeyRelation = "unknown";

    if (typeof relativeKm === "number") {
      if (Math.abs(relativeKm) <= 20) {
        journeyRelation = "current";
      } else if (relativeKm > 0) {
        journeyRelation = "upcoming";
      } else {
        journeyRelation = "passed";
      }
    }

    return {
      ...poi,
      relativeToLiveKm: relativeKm,
      relativeToLiveLabel:
        typeof relativeKm === "number" ? createRelativeLabel(relativeKm) : "noch ohne Live-Bezug",
      journeyRelation,
    };
  });
}

export function createPoiMarkerSubset(pois, markerLimit, locationData) {
  const journeyAwarePois = attachJourneyContextToPois(pois, locationData);

  return [...journeyAwarePois]
    .sort((left, right) => {
      const leftPriority =
        left.journeyRelation === "current" ? 0 : left.journeyRelation === "upcoming" ? 1 : 2;
      const rightPriority =
        right.journeyRelation === "current" ? 0 : right.journeyRelation === "upcoming" ? 1 : 2;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      const leftDistance = Math.abs(left.relativeToLiveKm ?? Number.POSITIVE_INFINITY);
      const rightDistance = Math.abs(right.relativeToLiveKm ?? Number.POSITIVE_INFINITY);

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return right.score - left.score;
    })
    .slice(0, markerLimit);
}

export function groupPoisByJourneyProgress(visiblePois, locationData) {
  const currentKm = locationData?.routeMatch?.distanceDoneKm;
  const journeyAwarePois = attachJourneyContextToPois(visiblePois, locationData);

  if (typeof currentKm !== "number") {
    return {
      currentKm: null,
      currentWindow: [],
      upcoming: journeyAwarePois.slice(0, 6),
      passed: [],
      nextPrimaryPoi: journeyAwarePois[0] || null,
    };
  }

  const currentWindow = journeyAwarePois.filter((poi) => poi.journeyRelation === "current");
  const upcoming = journeyAwarePois.filter(
    (poi) => poi.journeyRelation === "upcoming" && typeof poi.relativeToLiveKm === "number" && poi.relativeToLiveKm > 5,
  );
  const passed = journeyAwarePois
    .filter(
      (poi) => poi.journeyRelation === "passed" && typeof poi.relativeToLiveKm === "number" && poi.relativeToLiveKm < -5,
    )
    .sort((left, right) => Math.abs(left.relativeToLiveKm) - Math.abs(right.relativeToLiveKm));
  const nextPrimaryPoi = upcoming[0] || currentWindow[0] || null;

  return {
    currentKm,
    currentWindow: currentWindow.slice(0, 4),
    upcoming: upcoming.slice(0, 6),
    passed: passed.slice(0, 4),
    nextPrimaryPoi,
  };
}

export function createAudiencePoiContext(allPois, locationData) {
  const journeyAwarePois = attachJourneyContextToPois(
    allPois.filter((poi) => !poi.needsEnrichment && poi.score >= 0.35),
    locationData,
  );

  const currentArea = journeyAwarePois
    .filter((poi) => poi.journeyRelation === "current")
    .slice(0, 4);

  const nextInteresting = journeyAwarePois
    .filter(
      (poi) =>
        poi.journeyRelation === "upcoming" &&
        typeof poi.relativeToLiveKm === "number" &&
        poi.relativeToLiveKm <= 35,
    )
    .slice(0, 3);

  const nextHundredKm = journeyAwarePois
    .filter(
      (poi) =>
        poi.journeyRelation === "upcoming" &&
        typeof poi.relativeToLiveKm === "number" &&
        poi.relativeToLiveKm <= 100,
    )
    .slice(0, 6);

  const macroHighlightsAhead = journeyAwarePois
    .filter(
      (poi) =>
        poi.journeyRelation === "upcoming" &&
        (poi.score >= 0.75 ||
          poi.viewerCategory === "Nationalpark" ||
          poi.viewerCategory === "Highlight-Stadt" ||
          poi.viewerCategory === "Sehenswuerdigkeit"),
    )
    .slice(0, 4);

  const currentLead = currentArea[0] || nextInteresting[0] || nextHundredKm[0] || macroHighlightsAhead[0] || null;

  return {
    currentLead,
    currentArea,
    nextInteresting,
    nextHundredKm,
    macroHighlightsAhead,
  };
}
