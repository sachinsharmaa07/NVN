import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    globalSetup: ["./tests/setup/globalSetup.js"],
    // All API files share one MongoDB and wipe it between tests, so they must not run in parallel.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 120000, // the first run may download mongod
    // Set before any test file imports src/config/env.js: no MONGODB_URI needed, no log noise.
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      HMAC_SECRET: "ab".repeat(32),
      CLOUDINARY_CLOUD_NAME: "nivaran-test",
      CLOUDINARY_API_KEY: "123456789",
      CLOUDINARY_API_SECRET: "test-secret-value",
    },
  },
});
