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
  },

  output: "static",
  adapter: cloudflare(),
});
