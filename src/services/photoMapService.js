const PLACEHOLDER_ID = 'gallery-map-placeholder';
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

const mapEl = document.createElement('div');
mapEl.className = 'gallery-map-el';

let map = null;
let photoLayer = null;
let routeLayer = null;

function initPhotoMap() {
  if (map || !window.L) return;

  map = window.L.map(mapEl, {
    zoomControl: true,
    attributionControl: false,
    preferCanvas: true,
  });

  window.L.tileLayer(TILE_URL, { subdomains: 'abcd', maxZoom: 19 }).addTo(map);

  window.L.control
    .attribution({ prefix: false })
    .addAttribution(
      '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
    )
    .addTo(map);

  routeLayer = window.L.layerGroup().addTo(map);
  photoLayer = window.L.layerGroup().addTo(map);
}

export function updatePhotoMap(photos, routeData) {
  if (!map) return;

  routeLayer.clearLayers();
  if (routeData?.sampledRoute?.length) {
    const coords = routeData.sampledRoute.map((p) => [p.lat, p.lon]);
    window.L.polyline(coords, { color: '#eb8f34', weight: 2.5, opacity: 0.6 }).addTo(routeLayer);
  }

  photoLayer.clearLayers();
  const geoPhotos = photos.filter((p) => p.lat != null && p.lon != null);

  for (const photo of geoPhotos) {
    const icon = window.L.divIcon({
      className: '',
      html: `<div class="photo-map-marker"><img src="${photo.url}" alt="" /></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const marker = window.L.marker([photo.lat, photo.lon], { icon }).addTo(photoLayer);

    const dateLabel = photo.date
      ? new Date(photo.date).toLocaleString('de-DE', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Datum unbekannt';

    marker.bindPopup(`
      <div class="map-popup">
        <img src="${photo.url}" class="map-popup__img" alt="${photo.filename}" />
        <p class="map-popup__desc">${dateLabel}</p>
      </div>
    `);
  }

  if (geoPhotos.length > 0) {
    const bounds = window.L.latLngBounds(geoPhotos.map((p) => [p.lat, p.lon]));
    map.fitBounds(bounds, { padding: [40, 40] });
  } else if (routeData?.bounds) {
    const { minLat, maxLat, minLon, maxLon } = routeData.bounds;
    map.fitBounds(
      [
        [minLat, minLon],
        [maxLat, maxLon],
      ],
      { padding: [20, 20] },
    );
  }
}

export function mountPhotoMapObserver(getState) {
  const observer = new MutationObserver(() => {
    const placeholder = document.getElementById(PLACEHOLDER_ID);
    if (placeholder) {
      initPhotoMap();
      placeholder.parentNode?.replaceChild(mapEl, placeholder);
      requestAnimationFrame(() => {
        map?.invalidateSize();
        const { photoData, routeData } = getState();
        updatePhotoMap(photoData ?? [], routeData);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
