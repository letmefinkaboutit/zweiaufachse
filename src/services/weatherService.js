import { getWeatherPreset } from "../config/scenePresets.js";

// Wetter an der Live-Position (Open-Meteo, kein API-Key noetig).
// Gecacht pro ~10-km-Kachel, damit nicht jede GPS-Aktualisierung eine
// Abfrage ausloest.

const CACHE_TTL_MS = 20 * 60 * 1000;
const cache = new Map();

function tileKey(lat, lon) {
  return `${lat.toFixed(1)}_${lon.toFixed(1)}`;
}

export async function fetchWeather(latitude, longitude) {
  const key = tileKey(latitude, longitude);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.weather;
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,is_day&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Wetterdienst antwortete mit Status ${response.status}.`);
  }

  const data = await response.json();
  const current = data.current ?? {};
  const code = current.weather_code ?? 0;
  const preset = getWeatherPreset(code);

  const weather = {
    code,
    preset,
    temperatureC: current.temperature_2m ?? null,
    windKph: current.wind_speed_10m ?? null,
    isDay: current.is_day !== 0,
    // Lokale Zeit am Standort der Fahrer — Basis fuer den Schlaf-Zustand
    localTime: current.time ?? null,
    utcOffsetSeconds: data.utc_offset_seconds ?? 0,
  };

  cache.set(key, { weather, timestamp: Date.now() });
  return weather;
}
