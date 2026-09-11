import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import markdoc from "@astrojs/markdoc";
// import netlify from "@astrojs/netlify";
import keystatic from "@keystatic/astro";
import icon from "astro-icon";

import tailwindcss from "@tailwindcss/vite";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  // The program JSON endpoints use this to emit `catalogUrl` beside the
  // path-only `catalogPath`.
  //
  // Keep prose here free of Tailwind utility names — @tailwindcss/vite scans
  // this file for class candidates, so a bare positioning or display keyword in
  // a comment gets emitted as a real CSS rule and busts the bundle hash.
  site: "https://catalog.vhcc.edu",

  integrations: [react(), markdoc(), keystatic(), icon()],

  // adapter: netlify(),

  vite: {
    plugins: [tailwindcss()],

    // Pre-bundle Keystatic's API entrypoints at server start. Discovered lazily
    // they trigger a mid-session re-optimize, and the reload desyncs the workerd
    // runner from the dep-cache hashes — `astro dev` then dies on a stale
    // rolldown-runtime chunk.
    optimizeDeps: {
      include: [
        "@keystatic/astro/api",
        "@keystatic/astro/internal/keystatic-api.js",
      ],
    },
  },

  output: "static",

  // Optimize images at build time into static files. The adapter otherwise
  // routes every image through `/_image` at request time via the Cloudflare
  // Images binding, which needs Image Transformations enabled on the account —
  // without it the images 404 in production while working under `wrangler dev`,
  // since local mode emulates the binding regardless of entitlement.
  adapter: cloudflare({ imageService: "compile" }),
});
