import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import markdoc from "@astrojs/markdoc";
import netlify from "@astrojs/netlify";
import keystatic from "@keystatic/astro";
import icon from "astro-icon";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  integrations: [react(), markdoc(), keystatic(), icon()],
  adapter: netlify(),

  vite: {
    plugins: [tailwindcss()],
  },

  output: "static",
});
