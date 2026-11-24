// The server's VALIDATION_ERROR may list bad fields as { fields: { name: "msg" } } or
// { fields: [{ path: "name", message: "msg" }] }. Both become [["name", "msg"], ...].
export function serverFieldErrors(error) {
  const fields = error?.details?.fields;
  if (!fields) return [];
  if (Array.isArray(fields)) {
    return fields
      .map((f) => [String(f.path ?? f.field ?? ""), String(f.message ?? "")])
      .filter(([name]) => name);
  }
  return Object.entries(fields).map(([name, message]) => [name, String(message)]);
}
