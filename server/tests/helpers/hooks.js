import { expect } from "vitest";

/**
 * Asserts that a Mongoose operation is stopped by a schema hook rather than by anything else.
 * Without a database connection, an operation that is NOT stopped by a hook waits for a connection
 * and fails with a "buffering timed out" error. Rejecting for that reason must not count as a pass.
 */
export async function expectStoppedByHook(run) {
  let error;
  try {
    await Promise.race([
      run(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("HOOK_DID_NOT_RUN")), 3000)),
    ]);
  } catch (err) {
    error = err;
  }
  expect(error, "the operation should have been rejected").toBeDefined();
  expect(error.message).not.toMatch(/HOOK_DID_NOT_RUN|buffering|before initial connection/i);
}
