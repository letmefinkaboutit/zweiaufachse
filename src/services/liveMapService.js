const PLACEHOLDER_ID = "live-map-placeholder";
const TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

// Persistent element — survives router innerHTML replacement
const mapEl = document.createElement("div");
mapEl.className = "live-map-el";

const mapLoadingEl = document.createElement("div");
mapLoadingEl.className = "map-loading-overlay";
mapLoadingEl.innerHTML = `
  <div class="map-loading-dots">
    <span></span><span></span><span></span>
  </div>
  <p class="map-loading-label">Karte wird geladen</p>
`;
mapEl.appendChild(mapLoadingEl);

let map = null;
let posMarker = null;
let poiLayer = null;
let userHasPanned = false;

function categoryColor(poi) {
  switch (poi.viewerCategory) {
    case "Nationalpark":
    case "Naturhighlight":
    case "Aussichtspunkt":
      return "#3a8b37";
    case "Sehenswuerdigkeit":
    case "Highlight-Stadt":
    case "Kulturort":
      return "#c47a1e";
    case "Etappenort":
    case "Ankommen":
      return "#2c6fad";
    case "Grenze":
      return "#8a5ca7";
    case "Pause & Versorgung":
      return "#1a8a72";
    default:
      return "#eb8f34";
  }
}

function popupHtml(poi, imgUrl = null) {
  return `
    <div class="map-popup">
      ${imgUrl ? `<img src="${imgUrl}" class="map-popup__img" alt="${poi.name}"/>` : ""}
      <strong class="map-popup__name">${poi.name}</strong>
      <p class="map-popup__desc">${poi.shortDescription || ""}</p>
      <span class="map-popup__cat">${poi.viewerCategory || ""}</span>
    </div>
  `;
}

async function fetchWikiImage(name) {
  try {
    const res = await fetch(
      `https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

export function initLiveMap() {
  if (map || !window.L) return;

  map = window.L.map(mapEl, {
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true,
  });

  const tileLayer = window.L.tileLayer(TILE_URL, { subdomains: "abcd", maxZoom: 19 }).addTo(map);
  tileLayer.on("load", () => mapLoadingEl.classList.add("map-loading-overlay--done"));

  map.on("dragstart", () => { userHasPanned = true; });

  window.L.control.attribution({ prefix: false })
    .addAttribution('© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>')
    .addTo(map);

  poiLayer = window.L.layerGroup().addTo(map);
}

export function updateLiveMap(locationData, poiData) {
  if (!map) return;

  const lat = locationData?.latitude;
  const lon = locationData?.longitude;
  const currentKm = locationData?.routeMatch?.distanceDoneKm ?? 0;

  if (lat != null && lon != null) {
    if (!userHasPanned) {
      map.setView([lat, lon], 13, { animate: true, duration: 0.8 });
    }

    const icon = window.L.divIcon({
      className: "",
      html: `<div class="live-pos-marker"><div class="live-pos-marker__pulse"></div><div class="live-pos-marker__dot"></div></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    if (posMarker) {
      posMarker.setLatLng([lat, lon]);
    } else {
      posMarker = window.L.marker([lat, lon], { icon, zIndexOffset: 1000 }).addTo(map);
    }
  }

  poiLayer.clearLayers();

  const pois = (poiData?.pois ?? [])
    .filter((p) => p.latitude && p.longitude && p.routeKm != null)
    .filter((p) => Math.abs((p.routeKm ?? 0) - currentKm) < 60)
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);

  for (const poi of pois) {
    const color = categoryColor(poi);

    const marker = window.L.circleMarker([poi.latitude, poi.longitude], {
      radius: 7,
      fillColor: color,
      color: "white",
      weight: 2,
      fillOpacity: 0.9,
    }).addTo(poiLayer);

    const popup = window.L.popup({ maxWidth: 220, className: "map-popup-wrap" })
      .setContent(popupHtml(poi));
    marker.bindPopup(popup);

    marker.on("popupopen", async () => {
      const imgUrl = await fetchWikiImage(poi.name);
      if (imgUrl) popup.setContent(popupHtml(poi, imgUrl));
    });
  }
}

export function mountMapObserver() {
  const observer = new MutationObserver(() => {
    const placeholder = document.getElementById(PLACEHOLDER_ID);
    if (placeholder) {
      initLiveMap();
      userHasPanned = false;
      mapLoadingEl.classList.remove("map-loading-overlay--done");
      placeholder.parentNode?.replaceChild(mapEl, placeholder);
      requestAnimationFrame(() => map?.invalidateSize());
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
