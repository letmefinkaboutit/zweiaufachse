// Kopiere diese Datei nach locationProvider.local.js und trag deine echten Daten ein.
// locationProvider.local.js ist in .gitignore – Credentials landen NIE im Repo.
export default {
  activeProvider: "traccar",
  traccar: {
    enabled: true,
    refreshIntervalMs: 30000,
    baseUrl: "https://dein-traccar-server.de/api",
    auth: {
      mode: "bearer",
      token: "DEIN-API-TOKEN",
    },
    device: {
      uniqueId: "DEINE-GERAET-ID",
    },
  },
};
