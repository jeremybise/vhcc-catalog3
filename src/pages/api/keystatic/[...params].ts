import { makeHandler } from "@keystatic/astro/api";
// @ts-ignore virtual module provided by the Keystatic integration
import config from "virtual:keystatic-config";

// Shadows the route @keystatic/astro injects at this same pattern. Astro's dev
// server loads an injected route's node_modules entrypoint outside Vite's
// transform pipeline, which hands Keystatic's CommonJS dependency chain to
// workerd and throws `exports is not defined`. Declaring the route here keeps
// it a project module, so Vite processes it normally.
export const prerender = false;
export const ALL = makeHandler({ config });
