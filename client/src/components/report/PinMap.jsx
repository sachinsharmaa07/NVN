// The Leaflet map for report step 2, loaded only on that step (React.lazy in MapStep). Plain Leaflet, no
// react-leaflet: one map, one marker, two shapes. It never decides by itself: every move goes through
// `place`, which keeps the pin inside the pincode (insideArea) and otherwise snaps it back.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { t } from "@/i18n/t";
import { areaRings, insideArea } from "@/lib/geo";

const WORLD = [
  [-90, -180],
  [-90, 180],
  [90, 180],
  [90, -180],
];
const NUDGE_DEG = 0.0002; // about 20 m per arrow key press
const KEYS = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
const toLatLng = ([lng, lat]) => [lat, lng];
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// A 44px pin drawn with our tokens (Leaflet's default icon images don't survive bundling anyway).
const pinIcon = L.divIcon({
  className: "",
  html: `<span class="flex size-11 items-center justify-center text-primary"><svg viewBox="0 0 24 24" class="size-9 drop-shadow" aria-hidden="true"><path fill="currentColor" stroke="white" stroke-width="1.5" d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5" fill="white"/></svg></span>`,
  iconSize: [44, 44],
  iconAnchor: [22, 42],
});

/**
 * area: the pincode lookup ({ boundary, centroid, radiusM }); pin: [lng, lat] or null.
 * onPin([lng, lat]) for a move inside; onOutside() when a move was refused.
 */
export default function PinMap({ area, pin, onPin, onOutside, label }) {
  const el = useRef(null);
  const mapRef = useRef(null); // { map, place }
  const marker = useRef(null);
  const latest = useRef({ pin, onPin, onOutside });
  useEffect(() => {
    latest.current = { pin, onPin, onOutside };
  });

  useEffect(() => {
    const map = L.map(el.current, { zoomSnap: 0.5 });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    const rings = areaRings(area).map((ring) => ring.map(toLatLng));
    // Everything but the pincode is dimmed: a world-sized shape with the pincode cut out as holes.
    L.polygon([WORLD, ...rings], {
      stroke: false,
      fillColor: cssVar("--foreground"),
      fillOpacity: 0.4,
      interactive: false,
    }).addTo(map);
    const outline = L.polygon(rings, {
      color: cssVar("--primary"),
      weight: 2,
      fill: false,
      interactive: false,
    }).addTo(map);
    map.fitBounds(outline.getBounds(), { animate: false, padding: [16, 16] });

    const place = (lng, lat) => {
      if (!insideArea(area, [lng, lat])) {
        latest.current.onOutside();
        return false;
      }
      latest.current.onPin([lng, lat]);
      return true;
    };
    map.on("click", (e) => place(e.latlng.lng, e.latlng.lat));
    mapRef.current = { map, place };
    return () => {
      map.remove();
      marker.current = null;
    };
  }, [area]);

  useEffect(() => {
    const { map, place } = mapRef.current;
    if (!pin) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (marker.current) {
      marker.current.setLatLng(toLatLng(pin));
      return;
    }
    const m = L.marker(toLatLng(pin), {
      draggable: true,
      keyboard: true,
      icon: pinIcon,
      title: t("report.location.pinLabel"),
      alt: t("report.location.pinLabel"),
    }).addTo(map);
    // Dropped outside: back to where it was. The parent announces why.
    m.on("dragend", () => {
      const { lng, lat } = m.getLatLng();
      if (!place(lng, lat)) m.setLatLng(toLatLng(latest.current.pin));
    });
    m.getElement()?.addEventListener("keydown", (e) => {
      const step = KEYS[e.key];
      if (!step) return;
      e.preventDefault();
      e.stopPropagation(); // the map would pan on the same keys
      const [lng, lat] = latest.current.pin;
      place(lng + step[0] * NUDGE_DEG, lat + step[1] * NUDGE_DEG);
    });
    marker.current = m;
  }, [pin, area]);

  return (
    <div
      ref={el}
      aria-label={label}
      // isolate: Leaflet's own z-indexes (400 to 1000) stay inside the map (UI.md §3).
      className="isolate z-0 h-80 w-full rounded-lg border sm:h-96"
    />
  );
}
