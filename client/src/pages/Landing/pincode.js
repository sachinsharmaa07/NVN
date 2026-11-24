// Indian PIN codes are six digits and never start with 0 (the first digit is the postal zone, 1-9).
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

/** True for a well-formed Indian pincode such as "144401". Does not check that we serve it. */
export function isValidPincode(value) {
  return typeof value === "string" && PINCODE_PATTERN.test(value);
}

/** Keeps only digits and cuts to six, so pasted text like "144 401" or "PIN-144401" still works. */
export function cleanPincode(value) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 6);
}

// The same rule as a string, for the input's `pattern` attribute.
export const PINCODE_HTML_PATTERN = "[1-9][0-9]{5}";
