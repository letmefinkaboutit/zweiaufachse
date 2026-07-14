import { fetchTraccar, normalizeTraccarPosition } from "../../services/traccarProxyService.js";

// Holt die Live-Position ueber api/traccar.php. Der Proxy cacht serverseitig,
// haeufigeres Pollen kostet also nichts — 30 s passen zum Sendeintervall des
// Traccar Clients auf dem iPhone.

export function createTraccarProxyProvider({ onUpdate, onError, config }) {
  let intervalId = null;

  async function refresh() {
    const data = await fetchTraccar({ force: true });

    if (!data.configured) {
      onError(data.reason || "Traccar ist noch nicht eingerichtet.");
      return;
    }

    const snapshot = normalizeTraccarPosition(data.position);

    if (!snapshot) {
      onError("Traccar liefert noch keine Position für dieses Gerät.");
      return;
    }

    onUpdate(snapshot);
  }

  return {
    type: "traccar",
    label: "Traccar (Proxy)",
    async start() {
      await refresh();
      intervalId = window.setInterval(refresh, config.refreshIntervalMs);
    },
    stop() {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}
