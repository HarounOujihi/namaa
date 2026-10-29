import { defineConfig } from "vite";
import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import { browserslistToTargets } from "lightningcss";
import browserslist from "browserslist";

// Shared links open on old phones and in-app browsers (WhatsApp/Facebook).
const OLD_BROWSERS = ["defaults", "chrome >= 49", "android >= 5", "samsung >= 5", "ios >= 10.3", "safari >= 10.1", "firefox >= 52"];

export default defineConfig({
  plugins: [
    react(),
    // Browsers with native ES modules + dynamic import + async generators
    // (Chrome 64+, iOS/Safari 12+) get the regular bundle, transpiled to that
    // floor; older ones get a separate SystemJS bundle with polyfills. The
    // regular bundle needs no polyfills: it calls no ES built-in those lack,
    // and the DOM gaps (ResizeObserver, crypto.randomUUID,
    // IntersectionObserver) are feature-checked in code.
    legacy({ targets: OLD_BROWSERS }),
  ],
  // One stylesheet serves every browser: lower logical properties (inset,
  // margin-inline, inset-inline-start in RTL…) and nest clamp() so CSS
  // written for today still lays out on the same old browsers.
  css: {
    transformer: "lightningcss",
    lightningcss: { targets: browserslistToTargets(browserslist(OLD_BROWSERS)) },
  },
  build: {
    cssMinify: "lightningcss",
  },
  server: {
    port: 5173,
  },
});
