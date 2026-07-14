import { locationProviderConfig } from "../config/locationProvider.js";
import { createMockProvider } from "./providers/MockProvider.js";
import { createTraccarProvider } from "./providers/TraccarProvider.js";
import { createTraccarProxyProvider } from "./providers/TraccarProxyProvider.js";
import { fetchTraccar } from "../services/traccarProxyService.js";

// "auto" (Standard): fragt einmal den Traccar-Proxy. Liegt die Server-Config
// (api/traccar-config.php), laeuft die App mit echtem GPS — sonst faellt sie
// auf den Mock zurueck und zeigt die Startposition. Dadurch geht die App
// automatisch live, sobald die Config hochgeladen ist. Kein Code-Deploy noetig.
function createAutoProvider({ routeData, onUpdate, onError }) {
  let inner = null;

  return {
    type: "auto",
    label: "Auto",
    async start() {
      const traccar = await fetchTraccar();

      inner = traccar.configured && traccar.position
        ? createTraccarProxyProvider({ onUpdate, onError, config: locationProviderConfig.proxy })
        : createMockProvider({ routeData, onUpdate, config: locationProviderConfig.mock });

      await inner.start();
    },
    stop() {
      inner?.stop();
    },
  };
}

export function createLocationProvider({ routeData, onUpdate, onError }) {
  const commonContext = { routeData, onUpdate, onError };

  switch (locationProviderConfig.activeProvider) {
    case "traccar-proxy":
      return createTraccarProxyProvider({
        ...commonContext,
        config: locationProviderConfig.proxy,
      });
    case "traccar":
      return createTraccarProvider({
        ...commonContext,
        config: locationProviderConfig.traccar,
      });
    case "mock":
      return createMockProvider({
        ...commonContext,
        config: locationProviderConfig.mock,
      });
    case "auto":
    default:
      return createAutoProvider(commonContext);
  }
}
