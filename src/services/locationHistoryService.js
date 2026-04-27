const STORAGE_KEY = "zwa_loc_history";
const MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;
const MIN_STORE_INTERVAL_MS = 5 * 60 * 1000;

const EARTH_RADIUS_METERS = 6371000;

function haversineDistanceMeters(a, b) {
  const dlat = ((b.lat - a.lat) * Math.PI) / 180;
  const dlon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function nearestCumulativeMeters(routeData, latitude, longitude) {
  let best = null;
  let bestDist = Infinity;
  for (const pt of routeData.points) {
    const d = haversineDistanceMeters({ lat: latitude, lon: longitude }, { lat: pt.lat, lon: pt.lon });
    if (d < bestDist) {
      bestDist = d;
      best = pt.cumulativeDistanceMeters;
    }
  }
  return best;
}

function toLocalDateStr(isoString) {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateStrOffset(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toLocalDateStr(d.toISOString());
}

function computeDayKm(routeData, entries) {
  if (entries.length < 2) return null;
  const first = nearestCumulativeMeters(routeData, entries[0].latitude, entries[0].longitude);
  const last = nearestCumulativeMeters(
    routeData,
    entries[entries.length - 1].latitude,
    entries[entries.length - 1].longitude,
  );
  if (first === null || last === null) return null;
  return Math.max(0, (last - first) / 1000);
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw);
    const cutoff = Date.now() - MAX_AGE_MS;
    return entries.filter((e) => e?.timestamp && new Date(e.timestamp).getTime() >= cutoff);
  } catch {
    return [];
  }
}

export function appendToHistory(history, snapshot) {
  if (!snapshot?.timestamp || snapshot.latitude == null) return history;
  const last = history[history.length - 1];
  if (last) {
    if (last.timestamp === snapshot.timestamp) return history;
    const diff = new Date(snapshot.timestamp).getTime() - new Date(last.timestamp).getTime();
    if (diff < MIN_STORE_INTERVAL_MS) return history;
  }
  const cutoff = Date.now() - MAX_AGE_MS;
  const pruned = history.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
  const updated = [
    ...pruned,
    { latitude: snapshot.latitude, longitude: snapshot.longitude, timestamp: snapshot.timestamp },
  ];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}

export function computeDailyStats(routeData, history) {
  if (!routeData?.points?.length) return { todayKm: null, yesterdayKm: null };
  const today = dateStrOffset(0);
  const yesterday = dateStrOffset(-1);
  const todayEntries = history.filter((e) => toLocalDateStr(e.timestamp) === today);
  const yesterdayEntries = history.filter((e) => toLocalDateStr(e.timestamp) === yesterday);
  return {
    todayKm: computeDayKm(routeData, todayEntries),
    yesterdayKm: computeDayKm(routeData, yesterdayEntries),
  };
}
