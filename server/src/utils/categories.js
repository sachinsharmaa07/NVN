// Decision M1-6: the national category list. Decision M1-9: the default departments every city gets,
// and which one each category goes to. null means the city-admin triage queue.
export const CATEGORIES = Object.freeze([
  "pothole",
  "garbage",
  "streetlight",
  "water_leak",
  "drainage",
  "other",
]);

export const DEFAULT_DEPARTMENTS = Object.freeze([
  { code: "ROADS", name: "Roads" },
  { code: "SANITATION", name: "Sanitation" },
  { code: "ELECTRICAL", name: "Electrical" },
  { code: "WATER", name: "Water" },
  { code: "DRAINAGE", name: "Drainage" },
]);

export const DEFAULT_MAPPING = Object.freeze({
  pothole: "ROADS",
  garbage: "SANITATION",
  streetlight: "ELECTRICAL",
  water_leak: "WATER",
  drainage: "DRAINAGE",
  other: null,
});

// Decision M1-10: national SLA defaults in calendar hours. respond = acknowledged and assigned,
// resolve = fixed. A city can override per category later (SlaPolicy row with its cityId).
export const DEFAULT_SLA_HOURS = Object.freeze({
  pothole: { respondHours: 24, resolveHours: 168 },
  garbage: { respondHours: 12, resolveHours: 48 },
  streetlight: { respondHours: 24, resolveHours: 72 },
  water_leak: { respondHours: 12, resolveHours: 48 },
  drainage: { respondHours: 24, resolveHours: 72 },
  other: { respondHours: 48, resolveHours: 168 },
});
