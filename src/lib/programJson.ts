import {
  fmtRange,
  processProgram,
  type CourseIndex,
  type CourseMeta,
  type DisplayRow,
  type FootnoteText,
  type ProcessedNote,
} from "./programOfStudy";
import { awardMeta, type ProgramSource } from "./programSources";

/**
 * Serialization of program-of-study data for the public JSON endpoints.
 *
 * Consumers (the VHCC marketing site) can't parse Markdoc, so everything is
 * flattened here: footnote markers and inline course-tooltip tags become
 * structured parts alongside a plain-text rendering, and course descriptions are
 * hoisted into a single `courses` dictionary instead of being repeated on every
 * row that references them.
 */

/** Bump on breaking shape changes so consumers can detect a mismatch. */
export const API_VERSION = 1;

export interface JsonCredits {
  min: number;
  max: number;
  /** Human-readable form, e.g. "16" or "15-17". */
  display: string;
}

export type JsonTitlePart =
  | { kind: "text"; text: string }
  | { kind: "footnote"; footnote: number };

export interface JsonCourseRef {
  /** Code as displayed, which may be an editor override like "BUS EEE". */
  code: string;
  /** Plain title with footnote markers removed. */
  title: string;
  /** Title split into text runs and footnote references. */
  titleParts: JsonTitlePart[];
  /** Whether this row resolved to a real course in the catalog. */
  resolved: boolean;
  /**
   * Key into the response's `courses` map. Usually identical to `code`, but a
   * row can display an overridden code while still resolving to a real course.
   */
  courseCode?: string;
}

export type JsonRow =
  | { kind: "note"; text: string }
  | (JsonCourseRef & { kind: "course"; credits: string })
  | {
      kind: "options";
      label: string;
      choose: { min: number; max: number };
      credits: string;
      options: JsonCourseRef[];
    };

export interface JsonTerm {
  termLabel: string;
  credits: JsonCredits;
  rows: JsonRow[];
}

export type JsonNotePart =
  | { kind: "text"; text: string }
  | { kind: "course"; code: string; label?: string };

export interface JsonNote {
  number: number;
  /** Plain text with any inline course references rendered as their label. */
  text: string;
  parts: JsonNotePart[];
}

export interface JsonTrack {
  title: string;
  credits: JsonCredits;
  terms: JsonTerm[];
  notes: JsonNote[];
}

export interface JsonProgram {
  apiVersion: number;
  year: string;
  name: string;
  slug: string;
  award: string | null;
  awardLabel: string | null;
  section: string;
  page: { slug: string; title: string; path: string };
  catalogPath: string;
  catalogUrl?: string;
  credits: JsonCredits;
  tracks: JsonTrack[];
  /** Every course referenced above, keyed by course code. */
  courses: Record<string, CourseMeta>;
}

const awardLabels = new Map(awardMeta.map((meta) => [meta.key, meta.title]));

const credits = (min: number, max: number): JsonCredits => ({
  min,
  max,
  display: fmtRange(min, max),
});

const titleParts = (title: FootnoteText): JsonTitlePart[] =>
  title.parts.map((part) =>
    part.kind === "text"
      ? { kind: "text", text: part.text }
      : { kind: "footnote", footnote: Number(part.footnote) },
  );

const plainTitle = (title: FootnoteText) =>
  title.parts
    .filter((part) => part.kind === "text")
    .map((part) => (part as { text: string }).text)
    .join("")
    .trim();

const serializeNote = (note: ProcessedNote): JsonNote => ({
  number: note.number,
  text: note.parts
    .map((part) => (part.kind === "text" ? part.text : part.label || part.code))
    .join("")
    .trim(),
  parts: note.parts.map((part) =>
    part.kind === "text"
      ? { kind: "text", text: part.text }
      : { kind: "course", code: part.code, ...(part.label ? { label: part.label } : {}) },
  ),
});

/**
 * Serialize one program, collecting referenced course metadata into `courses`.
 * `courses` is mutated so it can be shared across a program's tracks.
 */
const serializeTrack = (
  track: ReturnType<typeof processProgram>,
  courses: Record<string, CourseMeta>,
): JsonTrack => {
  /** Hoist a row's course metadata into the shared map, returning its key. */
  const collect = (meta: CourseMeta | undefined) => {
    if (!meta) return undefined;
    courses[meta.code] ??= meta;
    return meta.code;
  };

  const courseRef = (
    code: string,
    title: FootnoteText,
    meta: CourseMeta | undefined,
  ): JsonCourseRef => {
    const courseCode = collect(meta);
    return {
      code,
      title: plainTitle(title),
      titleParts: titleParts(title),
      resolved: Boolean(courseCode),
      ...(courseCode && courseCode !== code ? { courseCode } : {}),
    };
  };

  const serializeRow = (row: DisplayRow): JsonRow => {
    if (row.kind === "note") return { kind: "note", text: row.note };

    if (row.kind === "options") {
      return {
        kind: "options",
        label: row.label,
        choose: { min: row.minChoices, max: row.maxChoices },
        credits: row.creditsText,
        options: row.options.map((option) =>
          courseRef(option.code, option.title, option.meta),
        ),
      };
    }

    return {
      kind: "course",
      ...courseRef(row.code, row.title, row.meta),
      credits: row.creditsText,
    };
  };

  return {
    title: track.title,
    credits: credits(track.programMin, track.programMax),
    terms: track.terms.map((term) => ({
      termLabel: term.termLabel,
      credits: credits(term.termMin, term.termMax),
      rows: term.rows.map(serializeRow),
    })),
    notes: track.notes.map(serializeNote),
  };
};

export interface SerializeOptions {
  courseIndex: CourseIndex;
  /** Absolute site origin, when `site` is configured in astro.config.mjs. */
  site?: URL | undefined;
  /** Include course titles/credits/descriptions in the `courses` map. */
  includeCourses?: boolean;
}

export function serializeProgram(
  source: ProgramSource,
  { courseIndex, site, includeCourses = true }: SerializeOptions,
): JsonProgram {
  const courses: Record<string, CourseMeta> = {};
  const processed = source.tracks.map((track) =>
    processProgram(track, { courseIndex, includeCourseMeta: includeCourses }),
  );
  const tracks = processed.map((track) => serializeTrack(track, courses));

  // Tracks of one program can differ in length (nursing's part-time evening
  // track spans more terms than the day track), so the program-level figure is
  // the range across all of them.
  const min = Math.min(...tracks.map((track) => track.credits.min));
  const max = Math.max(...tracks.map((track) => track.credits.max));

  return {
    apiVersion: API_VERSION,
    year: source.year,
    name: source.name,
    slug: source.slug,
    award: source.award,
    awardLabel: source.award ? awardLabels.get(source.award) ?? null : null,
    section: source.section,
    page: {
      slug: source.pageSlug,
      title: source.pageTitle,
      path: `/${source.year}/${source.section}/${source.pageSlug}`,
    },
    catalogPath: source.catalogPath,
    ...(site ? { catalogUrl: new URL(source.catalogPath, site).href } : {}),
    credits: credits(
      Number.isFinite(min) ? min : 0,
      Number.isFinite(max) ? max : 0,
    ),
    tracks,
    courses,
  };
}

export interface JsonProgramSummary {
  year: string;
  name: string;
  slug: string;
  award: string | null;
  awardLabel: string | null;
  section: string;
  page: { slug: string; title: string; path: string };
  catalogPath: string;
  catalogUrl?: string;
  credits: JsonCredits;
  trackCount: number;
  /** Endpoint holding this program's full course-by-course data. */
  endpoint: string;
}

export function summarizeProgram(
  source: ProgramSource,
  options: SerializeOptions,
): JsonProgramSummary {
  const full = serializeProgram(source, { ...options, includeCourses: false });
  return {
    year: full.year,
    name: full.name,
    slug: full.slug,
    award: full.award,
    awardLabel: full.awardLabel,
    section: full.section,
    page: full.page,
    catalogPath: full.catalogPath,
    ...(full.catalogUrl ? { catalogUrl: full.catalogUrl } : {}),
    credits: full.credits,
    trackCount: full.tracks.length,
    endpoint: programEndpoint(source),
  };
}

export const programEndpoint = (source: ProgramSource) =>
  `/api/${source.year}/programs/${source.pageSlug}/${source.slug}.json`;
