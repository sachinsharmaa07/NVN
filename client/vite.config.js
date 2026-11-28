import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// vitest/config re-exports Vite's defineConfig and adds the `test` block.
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { E2E_MODE, assertNoE2EBuild } from "./src/lib/buildGuard.js";

// HLD §7: preload only Mukta 400 latin, the body font, so it starts loading with the HTML. Build only:
// the file name is hashed, so it is looked up in the output bundle.
const preloadBodyFont = {
  name: "nivaran:preload-body-font",
  transformIndexHtml: {
    order: "post",
    handler(_html, { bundle }) {
      const font = Object.values(bundle ?? {}).find(
        (file) => file.type === "asset" && /mukta-latin-400-normal.*\.woff2$/.test(file.fileName),
      );
      if (!font) return;
      const attrs = { rel: "preload", as: "font", type: "font/woff2", crossorigin: true };
      return [{ tag: "link", attrs: { ...attrs, href: `/${font.fileName}` } }];
    },
  },
};

export default defineConfig(({ command, mode }) => {
  // Shell variables win over .env files (as in Vite itself), so `VITE_E2E=1 vite build` is caught too.
  assertNoE2EBuild(command, mode, { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env });
  return {
    plugins: [react(), tailwindcss(), preloadBodyFont],
    resolve: {
      // "@/lib/utils" -> "client/src/lib/utils" (same alias as jsconfig.json and components.json)
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: { port: 5173 },
    // The e2e bundle (fake sign-in) never lands in dist/, the folder a deploy picks up.
    build: mode === E2E_MODE ? { outDir: "dist-e2e" } : {},
    test: {
      environment: "jsdom",
      globals: false,
      setupFiles: ["./src/test/setup.js"],
      include: ["src/**/*.test.{js,jsx}"], // e2e/*.spec.js is Playwright's
      // CSS is irrelevant to behaviour tests; skipping it keeps the run fast.
      css: false,
    },
  };
});
