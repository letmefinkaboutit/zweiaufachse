import { renderDashboardPage } from "../pages/dashboardPage.js";
import { renderRoutePage } from "../pages/routePage.js";
import { renderGalleryPage } from "../pages/galleryPage.js";

export const moduleRegistry = [
  {
    id: "dashboard",
    route: "/dashboard",
    navLabel: "Start",
    title: "Dashboard",
    description: "Schneller Ueberblick fuer heute.",
    enabled: true,
    defaultRoute: true,
    render: renderDashboardPage,
  },
  {
    id: "route",
    route: "/route",
    navLabel: "Route",
    title: "Reiseverlauf",
    description: "Wo sie gestartet sind und wo sie gerade stehen.",
    enabled: true,
    render: renderRoutePage,
  },
  {
    id: "gallery",
    route: "/gallery",
    navLabel: "Galerie",
    title: "Galerie",
    description: "Fotos von unterwegs.",
    enabled: true,
    render: renderGalleryPage,
  },
];

export const navigationModules = moduleRegistry;
