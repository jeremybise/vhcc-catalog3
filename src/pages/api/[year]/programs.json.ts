import type { APIRoute, GetStaticPaths } from "astro";
import { getYearCourseIndex } from "../../../lib/programOfStudy";
import { API_VERSION, summarizeProgram } from "../../../lib/programJson";
import {
  awardMeta,
  getProgramSources,
  getProgramYears,
} from "../../../lib/programSources";

/**
 * GET /api/<year>/programs.json
 *
 * Index of every program of study in a catalog year: name, award type, credit
 * range, the catalog page it lives on, and the endpoint holding its full
 * course-by-course data. Course descriptions are omitted here to keep the index
 * small — fetch a program's own endpoint for those.
 */

export const getStaticPaths = (async () => {
  const years = await getProgramYears();
  return years.map((year) => ({ params: { year } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params, site }) => {
  const year = params.year ?? "";
  const [sources, courseIndex] = await Promise.all([
    getProgramSources(year),
    getYearCourseIndex(year),
  ]);

  const programs = sources.map((source) =>
    summarizeProgram(source, { courseIndex, site }),
  );

  const counts = Object.fromEntries(
    awardMeta.map((meta) => [
      meta.key,
      programs.filter((program) => program.award === meta.key).length,
    ]),
  );

  return new Response(
    JSON.stringify(
      {
        apiVersion: API_VERSION,
        year,
        programCount: programs.length,
        awards: awardMeta.map((meta) => ({
          key: meta.key,
          label: meta.title,
          count: counts[meta.key] ?? 0,
        })),
        programs,
      },
      null,
      2,
    ),
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
