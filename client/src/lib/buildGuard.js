// ADR 0003: VITE_E2E=1 swaps Auth0 for a fake signed-in citizen. That must never reach a real deploy, so
// vite.config.js calls this: a build with the flag set stops unless it is the e2e build (`--mode e2e`),
// which writes to its own folder (dist-e2e/) that nothing deploys.

export const E2E_MODE = "e2e";

/** Throws when building with VITE_E2E set in any mode other than "e2e". */
export function assertNoE2EBuild(command, mode, env) {
  if (command === "build" && env.VITE_E2E && mode !== E2E_MODE) {
    throw new Error(
      `VITE_E2E is set: refusing to build in "${mode}" mode. The e2e auth adapter fakes a signed-in ` +
        "user and must never ship. Unset VITE_E2E, or build the e2e bundle with --mode e2e.",
    );
  }
}
