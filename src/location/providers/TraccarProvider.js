function createAuthHeaders(auth) {
  const headers = {
    Accept: "application/json",
  };

  if (auth.mode === "bearer" && auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  if (auth.mode === "basic" && auth.email && auth.password) {
    headers.Authorization = `Basic ${btoa(`${auth.email}:${auth.password}`)}`;
  }

  return headers;
}

async function fetchJson(url, auth) {
  const response = await fetch(url, {
    headers: createAuthHeaders(auth),
  });

  if (!response.ok) {
    throw new Error(`Traccar antwortete mit Status ${response.status}.`);
  }

  return response.json();
}

async function resolveDevice(config) {
  const query = config.device.deviceId
    ? `id=${encodeURIComponent(config.device.deviceId)}`
    : `uniqueId=${encodeURIComponent(config.device.uniqueId)}`;
  const devices = await fetchJson(`${config.baseUrl}/devices?${query}`, config.auth);

  if (!devices.length) {
    throw new Error("In Traccar wurde kein passendes Geraet gefunden.");
  }

  return devices[0];
}

async function fetchLatestPosition(config, device) {
  if (!device.positionId) {
    throw new Error("Das Traccar-Geraet hat noch keine aktuelle Position.");
  }

  const positions = await fetchJson(
    `${config.baseUrl}/positions?id=${encodeURIComponent(device.positionId)}`,
    config.auth,
  );

  if (!positions.length) {
    throw new Error("Die aktuelle Traccar-Position konnte nicht geladen werden.");
  }

  return positions[0];
}

function normalizeTraccarSnapshot(device, position) {
  const batteryLevel =
    position.attributes?.batteryLevel ??
    position.attributes?.battery ??
    null;

  return {
    providerType: "traccar",
    providerLabel: "TraccarProvider",
    status: "connected",
    latitude: position.latitude,
    longitude: position.longitude,
    altitudeMeters: position.altitude ?? null,
    timestamp: position.fixTime || position.deviceTime || position.serverTime || new Date().toISOString(),
    speedKph: position.speed ? position.speed * 1.852 : 0,
    course: position.course ?? null,
    batteryLevel,
    accuracyMeters: position.accuracy ?? null,
    motion: Boolean(position.attributes?.motion ?? position.motion),
    deviceName: device.name || device.uniqueId || "Traccar-Geraet",
    note: "Live aus Traccar per REST-Polling geladen.",
    raw: {
      device,
      position,
    },
  };
}

export function createTraccarProvider({ onUpdate, onError, config }) {
  let intervalId = null;

  return {
    type: "traccar",
    label: "TraccarProvider",
    async start() {
      if (!config.enabled) {
        onError("TraccarProvider ist vorbereitet, aber in src/config/locationProvider.js noch deaktiviert.");
        return;
      }

      let device;
      try {
        device = await resolveDevice(config);
      } catch (error) {
        onError(error instanceof Error ? error.message : "Traccar-Geraet konnte nicht aufgeloest werden.");
        return;
      }

      async function refreshPosition() {
        try {
          const position = await fetchLatestPosition(config, device);
          onUpdate(normalizeTraccarSnapshot(device, position));
        } catch (error) {
          onError(error instanceof Error ? error.message : "Traccar-Liveposition konnte nicht geladen werden.");
        }
      }

      await refreshPosition();
      intervalId = window.setInterval(refreshPosition, config.refreshIntervalMs);
    },
    stop() {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}
