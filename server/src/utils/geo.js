// Pure GeoJSON helpers (ADR 0001: in-house instead of Turf). Coordinates are [longitude, latitude].

// Loose box around India incl. islands. A point outside it is almost always lat/lon swapped.
const INDIA = { minLon: 68, maxLon: 98, minLat: 6, maxLat: 38 };

const isPosition = (p) =>
  Array.isArray(p) &&
  p.length === 2 &&
  p.every(Number.isFinite) &&
  p[0] >= INDIA.minLon &&
  p[0] <= INDIA.maxLon &&
  p[1] >= INDIA.minLat &&
  p[1] <= INDIA.maxLat;

function ringProblems(ring, where) {
  if (!Array.isArray(ring) || ring.length < 4) return [`${where}: a ring needs at least 4 points`];
  const bad = ring.findIndex((p) => !isPosition(p));
  if (bad !== -1) return [`${where}: point ${bad} is not [lon, lat] inside India`];
  const [first, last] = [ring[0], ring.at(-1)];
  if (first[0] !== last[0] || first[1] !== last[1]) return [`${where}: ring is not closed`];
  if (ringCentre(ring).area === 0) return [`${where}: ring has no area`];
  return [];
}

const polygonProblems = (rings, where) =>
  !Array.isArray(rings) || rings.length === 0
    ? [`${where}: polygon has no rings`]
    : rings.flatMap((ring, i) => ringProblems(ring, `${where} ring ${i}`));

/** Returns [] for a valid Polygon or MultiPolygon inside India, else one message per problem. */
export function geometryProblems(geometry) {
  if (geometry?.type === "Polygon") return polygonProblems(geometry.coordinates, "polygon");
  if (geometry?.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    if (geometry.coordinates.length === 0) return ["multipolygon: no polygons"];
    return geometry.coordinates.flatMap((rings, i) => polygonProblems(rings, `polygon ${i}`));
  }
  return ["geometry must be a Polygon or MultiPolygon"];
}

/** True for a GeoJSON Point inside India. */
export const isIndiaPoint = (point) => point?.type === "Point" && isPosition(point.coordinates);

// Shoelace formula on the outer ring: signed area and area-weighted centre.
function ringCentre(ring) {
  let area = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    x += (x0 + x1) * cross;
    y += (y0 + y1) * cross;
  }
  return { area: area / 2, x: x / (3 * area), y: y / (3 * area) };
}

/**
 * Centre of the largest polygon's outer ring, as a GeoJSON Point (call only on a valid geometry).
 * shortcut: flat-plane maths and holes ignored; fine for a pincode-sized area, not for a state.
 */
export function centroidOf(geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const largest = polygons
    .map((rings) => ringCentre(rings[0]))
    .reduce((a, b) => (Math.abs(b.area) > Math.abs(a.area) ? b : a));
  // 6 decimals is about 10 cm: enough, and keeps reruns byte-identical.
  const round = (n) => Math.round(n * 1e6) / 1e6;
  return { type: "Point", coordinates: [round(largest.x), round(largest.y)] };
}
