import { routeSource } from "../data/routeSource.js";

const MAX_ROUTE_SAMPLES = 240;
const MAX_PROFILE_SAMPLES = 120;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sampleByStep(values, maxSamples) {
  if (values.length <= maxSamples) {
    return values;
  }

  const sampled = [];
  const step = (values.length - 1) / (maxSamples - 1);

  for (let index = 0; index < maxSamples; index += 1) {
    sampled.push(values[Math.round(index * step)]);
  }

  return sampled;
}

function formatCoordinate(point) {
  return `${point.lat.toFixed(2)}°, ${point.lon.toFixed(2)}°`;
}

function formatDistanceLabel(distanceKm) {
  return `${distanceKm.toFixed(0)} km`;
}

function createElevationPath(points, minElevation, maxElevation, width, height, padding) {
  if (!points.length) {
    return "";
  }

  const elevationSpan = Math.max(maxElevation - minElevation, 1);
  const horizontalStep = (width - padding * 2) / Math.max(points.length - 1, 1);

  return points
    .map((point, index) => {
      const x = padding + horizontalStep * index;
      const y =
        height - padding - ((point.ele - minElevation) / elevationSpan) * (height - padding * 2);
      const command = index === 0 ? "M" : "L";

      return `${command}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function createMilestones(points, totalDistanceKm, currentProgressRatio) {
  const milestoneRatios = [
    { label: "Start", ratio: 0 },
    { label: "Viertel", ratio: 0.25 },
    { label: "Halbzeit", ratio: 0.5 },
    { label: "Dreiviertel", ratio: 0.75 },
    { label: "Ziel", ratio: 1 },
  ];

  return milestoneRatios.map((milestone) => {
    const pointIndex = Math.min(points.length - 1, Math.round((points.length - 1) * milestone.ratio));
    const point = points[pointIndex];

    return {
      ...milestone,
      distanceLabel: formatDistanceLabel(totalDistanceKm * milestone.ratio),
      coordinateLabel: formatCoordinate(point),
      isReached: milestone.ratio <= currentProgressRatio,
    };
  });
}

// Erwartet das kompakte Format aus tools/build-route-data.mjs:
// Punkte als [lat, lon, ele, kumulierte Meter], Kennzahlen vorberechnet
// auf dem vollen Original-Track.
function buildRouteModel(data) {
  const points = data.points.map(([lat, lon, ele, cumulativeDistanceMeters]) => ({
    lat,
    lon,
    ele,
    cumulativeDistanceMeters,
  }));

  const totalDistanceKm = data.totalDistanceMeters / 1000;
  const currentProgressRatio = clamp(routeSource.currentProgressRatio, 0, 1);
  const currentPointIndex = Math.min(
    points.length - 1,
    Math.round((points.length - 1) * currentProgressRatio),
  );
  const currentPoint = points[currentPointIndex];
  const sampledRoute = sampleByStep(points, MAX_ROUTE_SAMPLES);
  const sampledProfile = sampleByStep(points, MAX_PROFILE_SAMPLES);
  const startPoint = points[0];
  const endPoint = points[points.length - 1];

  return {
    name: data.name,
    source: routeSource.filePath,
    points,
    pointsCount: data.originalPointsCount,
    totalDistanceKm,
    totalDistanceLabel: `${totalDistanceKm.toFixed(0)} km`,
    elevationGainMeters: data.elevationGainMeters,
    elevationGainLabel: `${Math.round(data.elevationGainMeters).toLocaleString("de-DE")} hm`,
    elevationLossMeters: data.elevationLossMeters,
    elevationLossLabel: `${Math.round(data.elevationLossMeters).toLocaleString("de-DE")} hm`,
    minElevation: data.minElevation,
    maxElevation: data.maxElevation,
    elevationSpanLabel: `${Math.round(data.minElevation)} m bis ${Math.round(data.maxElevation)} m`,
    startPoint,
    endPoint,
    startLabel: formatCoordinate(startPoint),
    endLabel: formatCoordinate(endPoint),
    currentProgress: {
      ratio: currentProgressRatio,
      percentLabel: `${Math.round(currentProgressRatio * 100)}%`,
      distanceDoneKm: totalDistanceKm * currentProgressRatio,
      distanceDoneLabel: formatDistanceLabel(totalDistanceKm * currentProgressRatio),
      remainingKm: totalDistanceKm * (1 - currentProgressRatio),
      remainingLabel: formatDistanceLabel(totalDistanceKm * (1 - currentProgressRatio)),
      currentPoint,
      currentLocationLabel: routeSource.currentLocationLabel,
      progressLabel: routeSource.currentProgressLabel,
      progressStory: routeSource.progressStory,
    },
    milestones: createMilestones(points, totalDistanceKm, currentProgressRatio),
    profileSvgPath: createElevationPath(sampledProfile, data.minElevation, data.maxElevation, 760, 220, 20),
    sampledRoute,
    bounds: data.bounds,
  };
}

// Pfade in der Config sind projekt-relativ ("./src/..."). Sie werden gegen den
// Projekt-Root aufgeloest, damit sie auch aus Unterseiten wie /live/ stimmen.
const projectRoot = new URL("../../", import.meta.url);

export async function loadRouteData() {
  const response = await fetch(new URL(routeSource.dataPath, projectRoot));

  if (!response.ok) {
    throw new Error(
      `Die Routendaten konnten nicht geladen werden (${response.status}). ` +
        "Fehlt route-data.json? Dann: node tools/build-route-data.mjs",
    );
  }

  const data = await response.json();

  if (data.schema !== 1 || !Array.isArray(data.points) || !data.points.length) {
    throw new Error("route-data.json hat ein unerwartetes Format. Bitte tools/build-route-data.mjs neu ausfuehren.");
  }

  return buildRouteModel(data);
}
