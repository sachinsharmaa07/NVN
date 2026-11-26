// ADR 0003: VITE_E2E=1 swaps Auth0 for a fake signed-in citizen. That must never reach a real deploy,
// so vite.config.js calls this and a production build with the flag set stops with an error.

/** Throws when `command` is "build" and VITE_E2E is set to anything non-empty. */
export function assertNoE2EBuild(command, env) {
  if (command === "build" && env.VITE_E2E) {
    throw new Error(
      "VITE_E2E is set: refusing to build. The e2e auth adapter fakes a signed-in user and must " +
        "never ship. Unset VITE_E2E and build again.",
    );
  }
}
