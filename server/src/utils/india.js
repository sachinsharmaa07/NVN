// India-specific constants shared by validators and models.

// 6 digits, first digit 1 to 9 (no leading zero).
export const PINCODE_RE = /^[1-9][0-9]{5}$/;

// ISO 3166-2:IN state and union territory codes (36).
export const INDIA_STATE_CODES = Object.freeze([
  "AN",
  "AP",
  "AR",
  "AS",
  "BR",
  "CH",
  "CG",
  "DH",
  "DL",
  "GA",
  "GJ",
  "HR",
  "HP",
  "JK",
  "JH",
  "KA",
  "KL",
  "LA",
  "LD",
  "MP",
  "MH",
  "MN",
  "ML",
  "MZ",
  "NL",
  "OD",
  "PB",
  "PY",
  "RJ",
  "SK",
  "TN",
  "TS",
  "TR",
  "UP",
  "UK",
  "WB",
]);

// State or UT names as GeoNames and data.gov.in spell them, normalised by stateKey(), to our codes.
const STATE_NAMES = {
  AN: ["andaman and nicobar islands"],
  AP: ["andhra pradesh"],
  AR: ["arunachal pradesh"],
  AS: ["assam"],
  BR: ["bihar"],
  CH: ["chandigarh"],
  CG: ["chhattisgarh"],
  DH: ["dadra and nagar haveli and daman and diu", "dadra and nagar haveli", "daman and diu"],
  DL: ["delhi"],
  GA: ["goa"],
  GJ: ["gujarat"],
  HR: ["haryana"],
  HP: ["himachal pradesh"],
  JK: ["jammu and kashmir"],
  JH: ["jharkhand"],
  KA: ["karnataka"],
  KL: ["kerala"],
  LA: ["ladakh"],
  LD: ["lakshadweep"],
  MP: ["madhya pradesh"],
  MH: ["maharashtra"],
  MN: ["manipur"],
  ML: ["meghalaya"],
  MZ: ["mizoram"],
  NL: ["nagaland"],
  OD: ["odisha", "orissa"],
  PB: ["punjab"],
  PY: ["puducherry", "pondicherry"],
  RJ: ["rajasthan"],
  SK: ["sikkim"],
  TN: ["tamil nadu"],
  TS: ["telangana"],
  TR: ["tripura"],
  UP: ["uttar pradesh"],
  UK: ["uttarakhand", "uttaranchal"],
  WB: ["west bengal"],
};
// "THE DADRA & NAGAR HAVELI" -> "dadra and nagar haveli"
const stateKey = (name) =>
  String(name)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the /, "");
const CODE_BY_STATE = new Map(
  Object.entries(STATE_NAMES).flatMap(([code, names]) => names.map((n) => [n, code])),
);

/** Our state code for a state name in any common spelling, or null. */
export const stateCodeFor = (name) => CODE_BY_STATE.get(stateKey(name)) ?? null;

/** City code for a district city (decision O2): "PB" + "South West Delhi" -> "PB-SOUTH-WEST-DELHI". */
export const districtCityCode = (stateCode, district) =>
  `${stateCode}-${String(district)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`.slice(0, 40);
