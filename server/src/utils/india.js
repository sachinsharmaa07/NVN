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
