function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createMockSnapshot(routeData, config, stepIndex) {
  const pattern = config.oscillationPattern[stepIndex % config.oscillationPattern.length] || 0;
  const progressRatio = clamp(config.baseProgressRatio + pattern, 0, 0.995);
  const pointIndex = Math.min(routeData.points.length - 1, Math.round((routeData.points.length - 1) * progressRatio));
  const point = routeData.points[pointIndex];

  return {
    providerType: "mock",
    providerLabel: "MockProvider",
    status: "connected",
    latitude: point.lat,
    longitude: point.lon,
    altitudeMeters: point.ele,
    timestamp: new Date(Date.now() - 90 * 1000).toISOString(),
    speedKph: config.speedKph + (stepIndex % 3),
    course: 145,
    batteryLevel: Math.max(config.batteryLevel - stepIndex, 54),
    accuracyMeters: 12,
    motion: true,
    deviceName: "Timo & Tino Testgeraet",
    note: "Simulierte Live-Position entlang der echten Route fuer UI-Tests.",
    raw: {
      progressRatio,
      pointIndex,
    },
  };
}

export function createMockProvider({ routeData, onUpdate, config }) {
  let intervalId = null;
  let stepIndex = 0;

  return {
    type: "mock",
    label: "MockProvider",
    async start() {
      const pushUpdate = () => {
        onUpdate(createMockSnapshot(routeData, config, stepIndex));
        stepIndex += 1;
      };

      pushUpdate();
      intervalId = window.setInterval(pushUpdate, config.updateIntervalMs);
    },
    stop() {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}
