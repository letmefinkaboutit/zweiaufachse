import { routeSource } from "../data/routeSource.js";

const defaults = {
  activeProvider: "mock",
  mock: {
    updateIntervalMs: 9000,
    baseProgressRatio: routeSource.currentProgressRatio,
    oscillationPattern: [0],
    speedKph: 21,
    batteryLevel: 78,
  },
  traccar: {
    enabled: false,
    refreshIntervalMs: 30000,
    baseUrl: "https://your-traccar-server.example/api",
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
  mock: { ...defaults.mock, ...(overrides.mock ?? {}) },
  traccar: { ...defaults.traccar, ...(overrides.traccar ?? {}), auth: { ...defaults.traccar.auth, ...(overrides.traccar?.auth ?? {}) }, device: { ...defaults.traccar.device, ...(overrides.traccar?.device ?? {}) } },
};
