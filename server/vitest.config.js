import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    // Set before any test file imports src/config/env.js: no MONGODB_URI needed, no log noise.
    env: { NODE_ENV: "test", LOG_LEVEL: "silent" },
  },
});
