// Runs once, before any test file. Decides which MongoDB the API tests use and hands the address to
// them through Vitest's `provide` (tests read it with `inject("mongo")`).
//   1. MONGODB_URI_TEST set: use it. Its database name must end in _test (the tests wipe it).
//   2. Otherwise: start a throwaway single-node replica set (mongodb-memory-server). A replica set,
//      not a plain mongod, because the role-change code uses transactions.
// If neither works the address is null and `startTestDb()` fails every DB test with the reason.
// It never skips: a green run must mean the auth cases really ran.
const dbName = (uri) => uri.split("?")[0].split("/")[3] ?? "";

export default async function setup({ provide }) {
  const external = process.env.MONGODB_URI_TEST;
  if (external) {
    if (!dbName(external).endsWith("_test")) {
      throw new Error("MONGODB_URI_TEST: database name must end in _test; tests wipe it");
    }
    provide("mongo", { uri: external, error: null });
    return undefined;
  }
  let replSet;
  try {
    const { MongoMemoryReplSet } = await import("mongodb-memory-server");
    // Pinned so a local run and CI use the same server as Atlas (7.0). Override: MONGOMS_VERSION.
    replSet = await MongoMemoryReplSet.create({
      binary: { version: process.env.MONGOMS_VERSION ?? "7.0.14" },
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    provide("mongo", { uri: replSet.getUri("nivaran_test"), error: null });
  } catch (err) {
    provide("mongo", { uri: null, error: String(err?.message ?? err).split("\n")[0] });
  }
  return async () => {
    await replSet?.stop();
  };
}
