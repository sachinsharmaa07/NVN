// The report map's "is the pin inside the pincode" check (decision M1-7), the client copy of the server rule:
// the polygon when there is one, else the radiusM circle around the centroid. Positions are [lng, lat].
// The server re-checks on submit (pincodeService.locatePoint), so this only spares a wasted round trip.

const EARTH_RADIUS_M = 6_371_008.8; // same as server/src/utils/geo.js
const rad = (deg) => (deg * Math.PI) / 180;

/** Great-circle (haversine) distance in metres, identical to the server's. */
export function distanceM([lon1, lat1], [lon2, lat2]) {
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Ray casting: count edge crossings of a ray going east from the point.
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// GeoJSON: the first ring is the outline, the others are holes.
const inPolygon = (point, [outer, ...holes]) =>
  inRing(point, outer) && !holes.some((hole) => inRing(point, hole));

/** `area`: the pincode lookup ({ boundary, centroid, radiusM }). `point`: [lng, lat]. */
export function insideArea(area, point) {
  const b = area.boundary;
  if (b?.type === "Polygon") return inPolygon(point, b.coordinates);
  if (b?.type === "MultiPolygon") return b.coordinates.some((poly) => inPolygon(point, poly));
  return distanceM(area.centroid.coordinates, point) <= area.radiusM;
}

/** The radius circle as a closed ring of `steps` [lng, lat] points, for drawing (Leaflet needs rings for holes). */
export function circleRing([lng, lat], radiusM, steps = 64) {
  const d = radiusM / EARTH_RADIUS_M;
  const ring = Array.from({ length: steps }, (_, i) => {
    const bearing = (2 * Math.PI * i) / steps;
    const lat2 = Math.asin(
      Math.sin(rad(lat)) * Math.cos(d) + Math.cos(rad(lat)) * Math.sin(d) * Math.cos(bearing),
    );
    const lng2 =
      rad(lng) +
      Math.atan2(
        Math.sin(bearing) * Math.sin(d) * Math.cos(rad(lat)),
        Math.cos(d) - Math.sin(rad(lat)) * Math.sin(lat2),
      );
    return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
  });
  return [...ring, ring[0]];
}

/** The pincode's outline rings ([lng, lat]) whatever its precision: polygon rings or the circle. */
export function areaRings(area) {
  const b = area.boundary;
  if (b?.type === "Polygon") return [b.coordinates[0]];
  if (b?.type === "MultiPolygon") return b.coordinates.map((poly) => poly[0]);
  return [circleRing(area.centroid.coordinates, area.radiusM)];
}
