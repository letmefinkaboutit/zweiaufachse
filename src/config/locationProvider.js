import { routeSource } from "../data/routeSource.js";

const defaults = {
  // "auto": nutzt Traccar, sobald api/traccar-config.php auf dem Server liegt,
  // sonst den Mock (Startposition). Kein Secret im Client — der Token bleibt
  // im PHP-Proxy. Zum Erzwingen: "traccar-proxy", "traccar" oder "mock".
  activeProvider: "auto",

  // Traccar ueber den serverseitigen Proxy (empfohlen)
  proxy: {
    refreshIntervalMs: 30000,
  },

  mock: {
    updateIntervalMs: 9000,
    baseProgressRatio: routeSource.currentProgressRatio,
    oscillationPattern: [0],
    speedKph: 21,
    batteryLevel: 78,
  },

  // Direkter Traccar-Zugriff aus dem Browser (nur mit Read-only-Token und
  // CORS-Freigabe — normalerweise nicht noetig, der Proxy ist der Weg).
  traccar: {
    enabled: false,
    refreshIntervalMs: 30000,
    baseUrl: "https://server.traccar.org/api",
    auth: {
      mode: "bearer",
      token: "",
      email: "",
      password: "",
    },
    device: {
      deviceId: null,
      uniqueId: "",
    },
  },
};

let overrides = {};
try {
  const mod = await import("./locationProvider.local.js");
  overrides = mod.default ?? {};
} catch {}

export const locationProviderConfig = {
  ...defaults,
  ...overrides,
  proxy: { ...defaults.proxy, ...(overrides.proxy ?? {}) },
  mock: { ...defaults.mock, ...(overrides.mock ?? {}) },
  traccar: {
    ...defaults.traccar,
    ...(overrides.traccar ?? {}),
    auth: { ...defaults.traccar.auth, ...(overrides.traccar?.auth ?? {}) },
    device: { ...defaults.traccar.device, ...(overrides.traccar?.device ?? {}) },
  },
};
