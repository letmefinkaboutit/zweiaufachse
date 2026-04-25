import { routeSource } from "../data/routeSource.js";

const EARTH_RADIUS_METERS = 6371000;
const MAX_ROUTE_SAMPLES = 240;
const MAX_PROFILE_SAMPLES = 120;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineDistanceMeters(pointA, pointB) {
  const latitudeDelta = toRadians(pointB.lat - pointA.lat);
  const longitudeDelta = toRadians(pointB.lon - pointA.lon);
  const latitudeA = toRadians(pointA.lat);
  const latitudeB = toRadians(pointB.lat);

  const haversineTerm =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversineTerm), Math.sqrt(1 - haversineTerm));
}

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

function createPolyline(points, bounds, width, height, padding) {
  const longitudeSpan = Math.max(bounds.maxLon - bounds.minLon, 0.0001);
  const latitudeSpan = Math.max(bounds.maxLat - bounds.minLat, 0.0001);

  return points
    .map((point) => {
      const x = padding + ((point.lon - bounds.minLon) / longitudeSpan) * (width - padding * 2);
      const y = height - padding - ((point.lat - bounds.minLat) / latitudeSpan) * (height - padding * 2);

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
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

function parseGpx(xmlText) {
  const parser = new DOMParser();
  const xmlDocument = parser.parseFromString(xmlText, "application/xml");
  const parserError = xmlDocument.querySelector("parsererror");

  if (parserError) {
    throw new Error("Die GPX-Datei konnte nicht gelesen werden.");
  }

  const trackNameNode = xmlDocument.getElementsByTagNameNS("*", "name")[0];
  const trackPoints = Array.from(xmlDocument.getElementsByTagNameNS("*", "trkpt"));

  if (!trackPoints.length) {
    throw new Error("Die GPX-Datei enthaelt keine Trackpunkte.");
  }

  const points = trackPoints.map((node) => {
    const elevationNode = node.getElementsByTagNameNS("*", "ele")[0];
    const timeNode = node.getElementsByTagNameNS("*", "time")[0];

    return {
      lat: Number.parseFloat(node.getAttribute("lat") || "0"),
      lon: Number.parseFloat(node.getAttribute("lon") || "0"),
      ele: Number.parseFloat(elevationNode?.textContent || "0"),
      time: timeNode?.textContent || null,
    };
  });

  return {
    name: trackNameNode?.textContent?.trim() || "Tourroute",
    points,
  };
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

function buildRouteModel(parsedRoute) {
  const { points, name } = parsedRoute;
  const bounds = {
    minLat: Number.POSITIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
    minLon: Number.POSITIVE_INFINITY,
    maxLon: Number.NEGATIVE_INFINITY,
  };

  let totalDistanceMeters = 0;
  let elevationGainMeters = 0;
  let elevationLossMeters = 0;
  let maxElevation = Number.NEGATIVE_INFINITY;
  let minElevation = Number.POSITIVE_INFINITY;

  const enrichedPoints = points.map((point, index) => {
    bounds.minLat = Math.min(bounds.minLat, point.lat);
    bounds.maxLat = Math.max(bounds.maxLat, point.lat);
    bounds.minLon = Math.min(bounds.minLon, point.lon);
    bounds.maxLon = Math.max(bounds.maxLon, point.lon);
    maxElevation = Math.max(maxElevation, point.ele);
    minElevation = Math.min(minElevation, point.ele);

    if (index === 0) {
      return {
        ...point,
        cumulativeDistanceMeters: 0,
      };
    }

    const previousPoint = points[index - 1];
    const segmentDistance = haversineDistanceMeters(previousPoint, point);
    const elevationDelta = point.ele - previousPoint.ele;

    totalDistanceMeters += segmentDistance;

    if (elevationDelta > 0) {
      elevationGainMeters += elevationDelta;
    } else {
      elevationLossMeters += Math.abs(elevationDelta);
    }

    return {
      ...point,
      cumulativeDistanceMeters: totalDistanceMeters,
    };
  });

  const totalDistanceKm = totalDistanceMeters / 1000;
  const currentProgressRatio = clamp(routeSource.currentProgressRatio, 0, 1);
  const currentPointIndex = Math.min(
    enrichedPoints.length - 1,
    Math.round((enrichedPoints.length - 1) * currentProgressRatio),
  );
  const currentPoint = enrichedPoints[currentPointIndex];
  const sampledRoute = sampleByStep(enrichedPoints, MAX_ROUTE_SAMPLES);
  const sampledProfile = sampleByStep(enrichedPoints, MAX_PROFILE_SAMPLES);
  const startPoint = enrichedPoints[0];
  const endPoint = enrichedPoints[enrichedPoints.length - 1];
  const startTime = startPoint.time ? new Date(startPoint.time) : null;
  const endTime = endPoint.time ? new Date(endPoint.time) : null;
  const daysSpan =
    startTime && endTime ? Math.max(1, Math.round((endTime - startTime) / (1000 * 60 * 60 * 24))) : null;

  return {
    name,
    source: routeSource.filePath,
    points: enrichedPoints,
    pointsCount: enrichedPoints.length,
    totalDistanceKm,
    totalDistanceLabel: `${totalDistanceKm.toFixed(0)} km`,
    elevationGainMeters,
    elevationGainLabel: `${Math.round(elevationGainMeters).toLocaleString("de-DE")} hm`,
    elevationLossMeters,
    elevationLossLabel: `${Math.round(elevationLossMeters).toLocaleString("de-DE")} hm`,
    minElevation,
    maxElevation,
    elevationSpanLabel: `${Math.round(minElevation)} m bis ${Math.round(maxElevation)} m`,
    startPoint,
    endPoint,
    startLabel: formatCoordinate(startPoint),
    endLabel: formatCoordinate(endPoint),
    daysSpan,
    journeySpanLabel: daysSpan ? `${daysSpan} GPX-Tage` : "keine Zeitspanne",
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
    milestones: createMilestones(enrichedPoints, totalDistanceKm, currentProgressRatio),
    mapSvgPolyline: createPolyline(sampledRoute, bounds, 760, 420, 28),
    profileSvgPath: createElevationPath(sampledProfile, minElevation, maxElevation, 760, 220, 20),
    sampledRoute,
    bounds,
  };
}

export async function loadRouteData() {
  const response = await fetch(encodeURI(routeSource.filePath));

  if (!response.ok) {
    throw new Error(`Die GPX-Datei konnte nicht geladen werden (${response.status}).`);
  }

  const xmlText = await response.text();
  return buildRouteModel(parseGpx(xmlText));
}
