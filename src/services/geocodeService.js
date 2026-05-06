const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const MIN_INTERVAL_MS = 90_000;

let lastCallTime = 0;

// Per-photo geocoding — own cache, no shared rate limiter
const _photoCache = new Map();

export async function geocodeOnce(lat, lon) {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (_photoCache.has(key)) return _photoCache.get(key);

  const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lon}&format=json&accept-language=de&addressdetails=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding ${res.status}`);

  const data = await res.json();
  const address = data.address || {};
  const result = {
    locationLabel: buildLocationLabel(address),
    flag: countryCodeToFlag(address.country_code || ""),
  };
  _photoCache.set(key, result);
  return result;
}

function countryCodeToFlag(isoCode) {
  if (!isoCode || isoCode.length !== 2) {
    return "";
  }

  return isoCode
    .toUpperCase()
    .replace(/./g, (ch) => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65));
}

function buildLocationLabel(address) {
  if (address.city) return address.city;
  if (address.town) return address.town;
  if (address.village) return `Nähe ${address.village}`;
  if (address.hamlet) return `Nähe ${address.hamlet}`;
  if (address.municipality) return `Nähe ${address.municipality}`;
  if (address.county) return address.county;
  return null;
}

export async function reverseGeocode(latitude, longitude) {
  const now = Date.now();

  if (now - lastCallTime < MIN_INTERVAL_MS) {
    return null;
  }

  lastCallTime = now;

  const url = `${NOMINATIM_URL}?lat=${latitude}&lon=${longitude}&format=json&accept-language=de&addressdetails=1`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Geocoding fehlgeschlagen (${response.status})`);
  }

  const data = await response.json();
  const address = data.address || {};

  return {
    locationLabel: buildLocationLabel(address),
    state: address.state || null,
    country: address.country || null,
    countryCode: address.country_code?.toUpperCase() ?? null,
    flag: countryCodeToFlag(address.country_code || ""),
  };
}
