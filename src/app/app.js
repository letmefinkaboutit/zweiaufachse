import { createShell } from "../layout/shell.js";
import { createRouter } from "./router.js";
import { moduleRegistry } from "../config/modules.js";
import { loadRouteData } from "../services/gpxRouteService.js";
import { createLocationProvider } from "../location/LocationProvider.js";
import { mapLocationToRoute } from "../services/routePositionService.js";
import { createDefaultPoiFilters, filterPois, loadPoiData } from "../services/poiService.js";
import { reverseGeocode } from "../services/geocodeService.js";
import { buildCountrySegments } from "../services/routeCountryService.js";
import { loadHistory, appendToHistory, computeDailyStats } from "../services/locationHistoryService.js";
import { mountMapObserver, updateLiveMap } from "../services/liveMapService.js";
import { startPhotoService } from "../services/photoService.js";
import { mountPhotoMapObserver } from "../services/photoMapService.js";
import { mountPhotoTileObserver, updatePhotoTile } from "../components/cards.js";

export async function createApp(root) {
  const router = createRouter(moduleRegistry);
  const state = {
    routeData: null,
    routeError: null,
    routeLoading: true,
    locationData: null,
    previousLocationData: null,
    geocodeData: null,
    countrySegments: null,
    locationHistory: loadHistory(),
    dailyStats: { todayKm: null, yesterdayKm: null },
    locationError: null,
    locationLoading: true,
    locationProviderType: null,
    poiData: null,
    poiError: null,
    poiLoading: true,
    poiFilters: createDefaultPoiFilters(),
    overpassPois: null,
    overpassUnavailable: false,
    photoData: [],
    photoLoading: true,
    photoError: null,
    galleryTab: 'grid',
  };
  let locationProvider = null;

  root.innerHTML = createShell();
  mountMapObserver();
  mountPhotoTileObserver();
  mountPhotoMapObserver(() => state);

  const photoServiceInstance = startPhotoService({
    onUpdate(photos) {
      state.photoData = photos;
      state.photoLoading = false;
      state.photoError = null;
      updatePhotoTile(photos, false);
      router.refresh();
    },
    onError(message) {
      state.photoLoading = false;
      state.photoError = message;
      updatePhotoTile([], false);
      router.refresh();
    },
  });

  const contentNode = root.querySelector("[data-app-content]");
  const navNode = root.querySelector("[data-app-nav]");

  router.mount(contentNode, navNode, () => state);

  root.addEventListener("change", async (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const filterKey = target.dataset.poiFilter;

    if (!filterKey) {
      return;
    }

    if (filterKey === "includeNeedsEnrichment" && target instanceof HTMLInputElement) {
      state.poiFilters = {
        ...state.poiFilters,
        [filterKey]: target.checked,
      };
    } else if (target instanceof HTMLSelectElement) {
      const nextValue = filterKey === "minScore" ? Number(target.value) : target.value;
      state.poiFilters = {
        ...state.poiFilters,
        [filterKey]: nextValue,
      };
    }

    router.refresh();
  });

  let lightboxIndex = 0;

  function updateLightboxDisplay() {
    const dialog = document.getElementById('photo-lightbox');
    if (!dialog) return;
    const photo = state.photoData[lightboxIndex];
    if (!photo) return;
    const img = dialog.querySelector('.photo-lightbox__img');
    const caption = dialog.querySelector('.photo-lightbox__caption');
    if (img) img.src = photo.url;
    if (caption) caption.textContent = photo.date ? new Date(photo.date).toLocaleString('de-DE') : '';
  }

  function navigateLightbox(dir) {
    const next = lightboxIndex + dir;
    if (next < 0 || next >= state.photoData.length) return;
    lightboxIndex = next;
    updateLightboxDisplay();
  }

  root.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-gallery-tab]');
    if (tabBtn) {
      state.galleryTab = tabBtn.dataset.galleryTab;
      router.refresh();
      return;
    }

    const photoTrigger = e.target.closest('[data-lightbox-src]');
    if (photoTrigger) {
      e.preventDefault();
      lightboxIndex = parseInt(photoTrigger.dataset.lightboxIndex ?? '0', 10);
      const dialog = document.getElementById('photo-lightbox');
      if (dialog) {
        updateLightboxDisplay();
        dialog.showModal();
      }
      return;
    }

    if (e.target.closest('[data-lightbox-close]') || e.target === document.getElementById('photo-lightbox')) {
      document.getElementById('photo-lightbox')?.close();
    }
  });

  let touchStartX = 0;
  root.addEventListener('touchstart', (e) => {
    if (e.target.closest('#photo-lightbox')) touchStartX = e.touches[0].clientX;
  }, { passive: true });
  root.addEventListener('touchend', (e) => {
    if (!e.target.closest('#photo-lightbox')) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) navigateLightbox(dx < 0 ? 1 : -1);
  });

  document.addEventListener('keydown', (e) => {
    const dialog = document.getElementById('photo-lightbox');
    if (!dialog?.open) return;
    if (e.key === 'ArrowRight') navigateLightbox(1);
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
  });

  try {
    state.routeData = await loadRouteData();
    state.countrySegments = buildCountrySegments(state.routeData);
    state.dailyStats = computeDailyStats(state.routeData, state.locationHistory);

    try {
      state.poiData = await loadPoiData();
      state.poiLoading = false;
    } catch (error) {
      state.poiError = error instanceof Error ? error.message : "POI-Daten konnten nicht geladen werden.";
      state.poiLoading = false;
    }

    locationProvider = createLocationProvider({
      routeData: state.routeData,
      onUpdate(snapshot) {
        state.previousLocationData = state.locationData;
        state.locationData = mapLocationToRoute(state.routeData, snapshot);
        state.locationHistory = appendToHistory(state.locationHistory, snapshot);
        state.dailyStats = computeDailyStats(state.routeData, state.locationHistory);
        updateLiveMap(state.locationData, state.routeData);
        state.locationLoading = false;
        state.locationError = null;
        state.locationProviderType = snapshot.providerType;

        // Skip re-renders on gallery grid/map tabs — content is photo-driven, not location-driven
        const onGallery = window.location.hash === '#/gallery';
        const onGalleryRouteTab = onGallery && state.galleryTab === 'route';

        reverseGeocode(snapshot.latitude, snapshot.longitude)
          .then((geocodeData) => {
            if (geocodeData) {
              state.geocodeData = geocodeData;
              if (!onGallery || onGalleryRouteTab) router.refresh();
            }
          })
          .catch(() => {});

        import("../services/overpassService.js")
          .then(({ fetchOverpassPois }) => fetchOverpassPois(snapshot.latitude, snapshot.longitude))
          .then((pois) => {
            state.overpassPois = pois;
            if (!onGallery || onGalleryRouteTab) router.refresh();
          })
          .catch((err) => {
            console.error("[Overpass]", err?.message || err);
            if (state.overpassPois === null) {
              state.overpassPois = [];
              state.overpassUnavailable = !!err?.overpassUnavailable;
              if (!onGallery || onGalleryRouteTab) router.refresh();
            }
          });

        if (!onGallery || onGalleryRouteTab) router.refresh();
      },
      onError(message) {
        state.locationLoading = false;
        state.locationError = message;
        router.refresh();
      },
    });

    state.locationProviderType = locationProvider.type;
    await locationProvider.start();
  } catch (error) {
    state.routeError = error instanceof Error ? error.message : "Unbekannter Fehler beim Laden der Route.";
  } finally {
    state.routeLoading = false;
    state.poiLoading = false;
    router.refresh();
  }

  window.addEventListener("beforeunload", () => {
    locationProvider?.stop();
    photoServiceInstance.stop();
  });
}
