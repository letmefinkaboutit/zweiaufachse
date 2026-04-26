import { routeSource } from "../data/routeSource.js";

export const locationProviderConfig = {
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
