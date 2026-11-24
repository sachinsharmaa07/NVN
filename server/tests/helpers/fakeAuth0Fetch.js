// Preloaded into a child process (node --import) so the real bootstrap script can run end to end
// without reaching Auth0. It replaces ONLY globalThis.fetch, the network edge of the Management
// API client. Every request is appended to FAKE_AUTH0_LOG as one JSON line, so the test can assert
// what the script asked Auth0 to do. FAKE_AUTH0_MODE=down makes every call fail like an outage.
import fs from "node:fs";

const log = process.env.FAKE_AUTH0_LOG;
const down = process.env.FAKE_AUTH0_MODE === "down";

globalThis.fetch = async (url, init = {}) => {
  const { pathname } = new URL(String(url));
  const body = init.body ? JSON.parse(init.body) : undefined;
  // Never store the secret: only what the assertions need.
  const note = {
    method: init.method ?? "GET",
    path: decodeURIComponent(pathname),
    app_metadata: body?.app_metadata,
  };
  fs.appendFileSync(log, `${JSON.stringify(note)}\n`);
  if (down) throw new TypeError("fetch failed");
  if (pathname === "/oauth/token") {
    return Response.json({
      access_token: "fake-m2m-token",
      expires_in: 86400,
      token_type: "Bearer",
    });
  }
  if (pathname.startsWith("/api/v2/users/")) return Response.json({}, { status: 200 });
  return Response.json({}, { status: 404 });
};
