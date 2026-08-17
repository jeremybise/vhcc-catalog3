import type { APIRoute, GetStaticPaths } from "astro";
import { getYearCourseIndex } from "../../../../lib/programOfStudy";
import { serializeProgram } from "../../../../lib/programJson";
import {
  getProgramSources,
  getProgramYears,
  type ProgramSource,
} from "../../../../lib/programSources";

/**
 * GET /api/<year>/programs/<page-slug>/<program-slug>.json
 *
 * One program of study, fully resolved: every term, every course (code, title,
 * credits, description), option groups with their "choose N of M" bounds,
 * footnotes, and per-term plus whole-program credit ranges. Programs offered on
 * multiple tracks (e.g. nursing's day and evening paths) return one entry per
 * track under `tracks`.
 *
 * The path mirrors the catalog page the program is authored on, and the program
 * slug matches that page's heading anchor.
 */

export const getStaticPaths = (async () => {
  const years = await getProgramYears();
  const paths = [];

  for (const year of years) {
    const sources = await getProgramSources(year);
    for (const source of sources) {
      paths.push({
        params: { year, program: `${source.pageSlug}/${source.slug}` },
        props: { source },
      });
    }
  }

  return paths;
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props, site }) => {
  const source = props.source as ProgramSource;
  const courseIndex = await getYearCourseIndex(source.year);

  return new Response(
    JSON.stringify(serializeProgram(source, { courseIndex, site }), null, 2),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        // Effective in dev/SSR only — static output is served by Netlify, which
        // takes its headers from public/_headers.
        "access-control-allow-origin": "*",
      },
    },
  );
};
