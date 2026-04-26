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

export function mapLocationToRoute(routeData, snapshot) {
  if (!routeData?.points?.length) {
    return null;
  }

  let nearestPoint = routeData.points[0];
  let nearestPointIndex = 0;
  let nearestDistanceMeters = Number.POSITIVE_INFINITY;

  routeData.points.forEach((point, index) => {
    const distance = haversineDistanceMeters(
      { lat: snapshot.latitude, lon: snapshot.longitude },
      { lat: point.lat, lon: point.lon },
    );

    if (distance < nearestDistanceMeters) {
      nearestDistanceMeters = distance;
      nearestPoint = point;
      nearestPointIndex = index;
    }
  });

  const distanceDoneKm = nearestPoint.cumulativeDistanceMeters / 1000;
  const progressRatio = routeData.totalDistanceKm > 0 ? distanceDoneKm / routeData.totalDistanceKm : 0;
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
