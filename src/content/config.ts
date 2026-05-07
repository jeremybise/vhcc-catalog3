import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * "catalog" collection — one entry per .mdoc file under any year's catalog folder.
 * Entry IDs look like: "2026-2027/catalog/about-the-college/core-values"
 * The year folder name is used directly as the URL year segment.
 */
const catalog = defineCollection({
  loader: glob({
    pattern: "*/catalog/**/*.mdoc",
    base: "./src/content",
  }),
  schema: z.object({
    title: z.string(),
    /** Position within the section — lower numbers appear first in the sidebar. */
    order: z.number().optional().default(99),
  }),
});

/**
 * "courses" collection — one entry per .mdoc file under any year's courses folder.
 * Entry IDs look like: "2026-2027/courses/ACC-211"
 */
const courses = defineCollection({
  loader: glob({
    pattern: "*/courses/*.mdoc",
    base: "./src/content",
  }),
  schema: z.object({
    title: z.string(),
    code: z.string(),
    category: z.string(),
    credits: z.string().nullable().default(""),
    prerequisites: z.array(z.string()).default([]),
    prerequisiteNote: z.string().optional(),
    corequisites: z.array(z.string()).default([]),
    corequisiteNote: z.string().optional(),
  }),
});

/**
 * "catalogYears" collection — one entry per year root index.mdoc.
 * Entry IDs look like: "2026-2027/index"
 */
const catalogYears = defineCollection({
  loader: glob({
    pattern: "*/index.mdoc",
    base: "./src/content",
  }),
  schema: z.object({
    title: z.string(),
  }),
});

export const collections = { catalog, courses, catalogYears };
