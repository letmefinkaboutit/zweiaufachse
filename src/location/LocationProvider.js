import { locationProviderConfig } from "../config/locationProvider.js";
import { createMockProvider } from "./providers/MockProvider.js";
import { createTraccarProvider } from "./providers/TraccarProvider.js";

export function createLocationProvider({ routeData, onUpdate, onError }) {
  const commonContext = {
    routeData,
    onUpdate,
    onError,
  };

  switch (locationProviderConfig.activeProvider) {
    case "traccar":
      return createTraccarProvider({
        ...commonContext,
        config: locationProviderConfig.traccar,
      });
    case "mock":
    default:
      return createMockProvider({
        ...commonContext,
        config: locationProviderConfig.mock,
      });
  }
}
