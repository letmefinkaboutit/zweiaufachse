const EARTH_RADIUS_METERS = 6371000;

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

function formatDistanceLabel(distanceKm) {
  return `${distanceKm.toFixed(0)} km`;
}

function formatLastUpdate(isoString) {
  if (!isoString) {
    return "Keine Zeitangabe";
  }

  const timestamp = new Date(isoString);

  if (Number.isNaN(timestamp.getTime())) {
    return "Zeit unklar";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(timestamp);
}

function formatCoordinate(latitude, longitude) {
  return `${latitude.toFixed(3)}°, ${longitude.toFixed(3)}°`;
}

// Speed below this threshold is treated as stationary (GPS drift + slow pushing uphill excluded).
// At 5-min update intervals: 4 km/h = ~333 m movement required to count as riding.
const MOVEMENT_THRESHOLD_KPH = 4;

export function computeMovementStatus(currentLocation, previousLocation) {
  if (Number.isFinite(currentLocation?.speedKph)) {
    return {
      isMoving: currentLocation.speedKph >= MOVEMENT_THRESHOLD_KPH,
      speedKph: currentLocation.speedKph,
    };
  }

  if (typeof currentLocation?.motion === "boolean") {
    return {
      isMoving: currentLocation.motion,
      speedKph: null,
    };
  }

  if (!currentLocation?.timestamp || !previousLocation?.timestamp) {
    return { isMoving: null, speedKph: null };
  }

  const timeDiffMs =
    new Date(currentLocation.timestamp).getTime() -
    new Date(previousLocation.timestamp).getTime();

  if (timeDiffMs <= 0 || Number.isNaN(timeDiffMs)) {
    return { isMoving: null, speedKph: null };
  }

  const distanceM = haversineDistanceMeters(
    { lat: currentLocation.latitude, lon: currentLocation.longitude },
    { lat: previousLocation.latitude, lon: previousLocation.longitude },
  );

  const speedKph = distanceM / 1000 / (timeDiffMs / 3_600_000);

  return {
    isMoving: speedKph >= MOVEMENT_THRESHOLD_KPH,
    speedKph,
  };
}

// Fenster fuer den Monotonie-Guard: Kandidaten nahe der letzten Match-Position
// werden bevorzugt, damit der Fortschritt nicht auf einen falschen Streckenast
// springt, wenn die Route sich selbst nahekommt oder die Fahrer abseits fahren.
const WINDOW_BACKWARD_METERS = 30_000;
const WINDOW_FORWARD_METERS = 80_000;

let lastMatchedCumMeters = null;

// Projiziert die Live-Position auf das naechste Routen-SEGMENT (nicht nur den
// naechsten Punkt) — noetig, weil der simplifizierte Track auf Geraden
// mehrere hundert Meter Punktabstand haben kann.
function projectOntoRoute(points, latitude, longitude) {
  const kx = 111320 * Math.cos((latitude * Math.PI) / 180);
  const ky = 110574;
  const px = longitude * kx;
  const py = latitude * ky;

  let best = null;
  let windowed = null;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const ax = a.lon * kx, ay = a.lat * ky;
    const bx = b.lon * kx, by = b.lat * ky;
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
      t = Math.min(1, Math.max(0, t));
    }

    const ex = px - (ax + t * dx);
    const ey = py - (ay + t * dy);
    const distSq = ex * ex + ey * ey;
    const cumMeters =
      a.cumulativeDistanceMeters + t * (b.cumulativeDistanceMeters - a.cumulativeDistanceMeters);

    const candidate = { distSq, t, index: i, cumMeters };

    if (!best || distSq < best.distSq) {
      best = candidate;
    }

    if (
      lastMatchedCumMeters !== null &&
      cumMeters >= lastMatchedCumMeters - WINDOW_BACKWARD_METERS &&
      cumMeters <= lastMatchedCumMeters + WINDOW_FORWARD_METERS &&
      (!windowed || distSq < windowed.distSq)
    ) {
      windowed = candidate;
    }
  }

  // Fenster-Kandidat gewinnt, solange er nicht deutlich schlechter ist als das
  // globale Optimum (echte grosse Spruenge, z. B. Zugtransfer, bleiben moeglich).
  const globalDist = Math.sqrt(best.distSq);
  if (windowed) {
    const windowedDist = Math.sqrt(windowed.distSq);
    if (windowedDist <= Math.max(500, globalDist * 2)) {
      return windowed;
    }
  }

  return best;
}

export function mapLocationToRoute(routeData, snapshot) {
  if (!routeData?.points?.length) {
    return null;
  }

  const match = projectOntoRoute(routeData.points, snapshot.latitude, snapshot.longitude);
  const a = routeData.points[match.index];
  const b = routeData.points[Math.min(match.index + 1, routeData.points.length - 1)];
  const nearestPoint = {
    lat: a.lat + match.t * (b.lat - a.lat),
    lon: a.lon + match.t * (b.lon - a.lon),
    ele: a.ele + match.t * (b.ele - a.ele),
    cumulativeDistanceMeters: match.cumMeters,
  };
  const nearestPointIndex = match.index;
  const nearestDistanceMeters = Math.sqrt(match.distSq);

  lastMatchedCumMeters = match.cumMeters;

  const distanceDoneKm = nearestPoint.cumulativeDistanceMeters / 1000;
  const progressRatio = Math.min(1, Math.max(0, routeData.totalDistanceKm > 0 ? distanceDoneKm / routeData.totalDistanceKm : 0));
  const remainingKm = Math.max(routeData.totalDistanceKm - distanceDoneKm, 0);

  return {
    ...snapshot,
    routeMatch: {
      point: nearestPoint,
      pointIndex: nearestPointIndex,
      distanceFromRouteMeters: nearestDistanceMeters,
      progressRatio,
      percentLabel: `${Math.round(progressRatio * 100)}%`,
      distanceDoneKm,
      distanceDoneLabel: formatDistanceLabel(distanceDoneKm),
      remainingKm,
      remainingLabel: formatDistanceLabel(remainingKm),
      coordinateLabel: formatCoordinate(snapshot.latitude, snapshot.longitude),
      lastUpdateLabel: formatLastUpdate(snapshot.timestamp),
      routeStatusLabel:
        nearestDistanceMeters <= 100
          ? "sauber auf der Route"
          : nearestDistanceMeters <= 500
            ? "nahe an der Route"
            : "merklich neben der Route",
    },
  };
}
