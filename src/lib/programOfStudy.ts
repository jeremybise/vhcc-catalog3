import { getCollection, type CollectionEntry } from "astro:content";

/**
 * Shared resolution logic for `{% programofstudy %}` tables.
 *
 * Both the rendering component ([src/components/ProgramOfStudy.astro]) and the
 * JSON endpoints under `src/pages/api/` run everything through here, so the
 * credit totals the marketing site pulls are computed by the exact same code
 * that produced the catalog page. If this logic is duplicated anywhere, the two
 * surfaces will eventually disagree about how many credits a degree takes.
 */

export type RowType = "course" | "options" | "note";

export interface CourseMeta {
  code: string;
  title: string;
  credits: string;
  description: string;
}

export type FootnotePart =
  | { kind: "text"; text: string }
  | { kind: "footnote"; footnote: string };

export interface FootnoteText {
  parts: FootnotePart[];
}

export type NotePart =
  | { kind: "text"; text: string }
  | { kind: "course"; code: string; label?: string };

/** Raw shape authored in the .mdoc tag attributes. */
export interface ProgramRowInput {
  rowType?: "course" | "options" | "note";
  course?: string | null;
  codeOverride?: string;
  titleOverride?: string;
  creditsOverride?: string;
  optionLabel?: string;
  minChoices?: number | null;
  maxChoices?: number | null;
  options?: (string | null)[];
  note?: string;
}

export interface ProgramTermInput {
  termLabel?: string;
  rows?: ProgramRowInput[];
}

export interface ProgramNoteInput {
  number?: number | string | null;
  text?: string;
}

export interface ProgramInput {
  title?: string;
  showTotals?: boolean;
  notes?: ProgramNoteInput[];
  terms?: ProgramTermInput[];
}

export type DisplayRow =
  | { kind: "note"; note: string }
  | {
      kind: "course";
      code: string;
      title: FootnoteText;
      creditsText: string;
      meta?: CourseMeta;
    }
  | {
      kind: "options";
      label: string;
      minChoices: number;
      maxChoices: number;
      options: { code: string; title: FootnoteText; meta?: CourseMeta }[];
      creditsText: string;
    };

export interface ProcessedTerm {
  termLabel: string;
  rows: DisplayRow[];
  total: string;
  termMin: number;
  termMax: number;
}

export interface ProcessedNote {
  number: number;
  text: string;
  parts: NotePart[];
}

export interface ProcessedProgram {
  title: string;
  showTotals: boolean;
  terms: ProcessedTerm[];
  notes: ProcessedNote[];
  /** Lookup used by the renderer to tell live footnote refs from stray `[n]`. */
  noteMap: Map<string, ProcessedNote>;
  programMin: number;
  programMax: number;
  totalCredits: string;
}

export type CourseEntry = CollectionEntry<"courses">;
export type CourseIndex = Map<string, CourseEntry>;

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

/**
 * Course references in a program table may be written as the file slug
 * ("MTH-161"), the course code ("MTH 161"), or the course title — index all
 * three so `resolveCourse` accepts whatever an editor typed.
 */
export function buildCourseIndex(courses: CourseEntry[]): CourseIndex {
  const index: CourseIndex = new Map();
  for (const course of courses) {
    const slug = (course.id.split("/").pop() ?? "").toLowerCase();
    const code = (course.data.code ?? "").toLowerCase();
    const titleSlug = slugify(course.data.title ?? "");
    if (slug) index.set(slug, course);
    if (code) index.set(code, course);
    if (titleSlug) index.set(titleSlug, course);
  }
  return index;
}

/** Build a course index scoped to one catalog year. */
export async function getYearCourseIndex(year: string): Promise<CourseIndex> {
  const courses = await getCollection("courses");
  return buildCourseIndex(
    courses.filter((entry) => entry.id.startsWith(`${year}/courses/`)),
  );
}

export const parseCredits = (input: string | null | undefined) => {
  if (!input) return null;
  const cleaned = input.trim();
  if (!cleaned) return null;

  const range = cleaned.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (range) {
    const min = Number.parseFloat(range[1]);
    const max = Number.parseFloat(range[2]);
    if (!Number.isNaN(min) && !Number.isNaN(max)) return { min, max };
  }

  const single = cleaned.match(/^(\d+(?:\.\d+)?)$/);
  if (single) {
    const value = Number.parseFloat(single[1]);
    if (!Number.isNaN(value)) return { min: value, max: value };
  }

  return null;
};

export const fmt = (num: number) =>
  Number.isInteger(num) ? `${num}` : `${num.toFixed(1)}`;

export const fmtRange = (min: number, max: number) =>
  min === max ? fmt(min) : `${fmt(min)}-${fmt(max)}`;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const stripMarkdown = (value: string) =>
  value
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[*_`~>#]/g, "")
    .trim();

export const getCourseDescription = (entry: CourseEntry) => {
  const body = stripMarkdown(entry.body || "");
  if (!body) return "No description available.";
  return body;
};

/** Split `Course Title[1]` into text runs and footnote references. */
export const splitNoteLinks = (value: string): FootnoteText => {
  const parts: FootnotePart[] = [];
  const noteLinkRegex = /\[(\d+)\]/g;
  let lastIndex = 0;

  for (const match of value.matchAll(noteLinkRegex)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push({ kind: "text", text: value.slice(lastIndex, start) });
    }
    parts.push({ kind: "footnote", footnote: match[1] || "" });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < value.length || parts.length === 0) {
    parts.push({ kind: "text", text: value.slice(lastIndex) });
  }

  return { parts };
};

const courseTooltipTagRegex =
  /\{\%\s*coursetooltip\s+code=\"([^\"]+)\"(?:\s+label=\"([^\"]+)\")?\s*\/\%\}/gi;

/**
 * Footnote text may embed `{% coursetooltip %}` tags. Markdoc doesn't parse tag
 * attributes recursively, so pull them out into structured parts rather than
 * leaking raw tag syntax to whatever renders the note.
 */
export const parseNoteParts = (text: string): NotePart[] => {
  const parts: NotePart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(courseTooltipTagRegex)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push({ kind: "text", text: text.slice(lastIndex, start) });
    }
    parts.push({
      kind: "course",
      code: (match[1] || "").trim(),
      label: match[2]?.trim() || undefined,
    });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ kind: "text", text: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ kind: "text", text }];
};

export interface ProcessOptions {
  courseIndex: CourseIndex;
  /**
   * Attach full course metadata (title, credits, description) to each row.
   * The print view and the program index both switch this off, since the
   * descriptions dominate the payload and neither one shows them.
   */
  includeCourseMeta?: boolean;
}

/**
 * Resolve one program-of-study table: look up every course reference, compute
 * per-term and whole-program credit ranges, and normalize footnotes.
 */
export function processProgram(
  input: ProgramInput,
  { courseIndex, includeCourseMeta = true }: ProcessOptions,
): ProcessedProgram {
  const resolveCourse = (ref: string | null | undefined) => {
    if (!ref) return null;
    return courseIndex.get(ref.toLowerCase()) ?? null;
  };

  const metaFor = (entry: CourseEntry): CourseMeta | undefined =>
    includeCourseMeta
      ? {
          code: entry.data.code,
          title: entry.data.title,
          credits: entry.data.credits || "",
          description: getCourseDescription(entry),
        }
      : undefined;

  const normalizedNotes = (input.notes ?? [])
    .map((note) => {
      const raw = note.number;
      if (raw === null || raw === undefined || raw === "") return null;
      const num = Number(raw);
      if (Number.isNaN(num) || num < 1) return null;
      return {
        number: Math.trunc(num),
        text: note.text?.trim() || "",
      };
    })
    .filter((note): note is { number: number; text: string } => note !== null)
    .sort((a, b) => a.number - b.number);

  const notes: ProcessedNote[] = normalizedNotes.map((note) => ({
    ...note,
    parts: parseNoteParts(note.text),
  }));

  const noteMap = new Map(notes.map((note) => [String(note.number), note]));

  const terms: ProcessedTerm[] = (input.terms ?? []).map((term) => {
    const rows = term.rows ?? [];
    let termMin = 0;
    let termMax = 0;

    const displayRows: DisplayRow[] = rows.map((row) => {
      const rowType: RowType = row.rowType ?? "course";

      if (rowType === "note") {
        return { kind: "note", note: row.note || "" };
      }

      if (rowType === "options") {
        const optionRefs = (row.options ?? []).filter((value): value is string =>
          Boolean(value),
        );
        const optionItems = optionRefs.map((ref) => {
          const entry = resolveCourse(ref);
          if (entry) {
            return {
              code: entry.data.code,
              title: entry.data.title,
              credits: parseCredits(entry.data.credits || ""),
              meta: metaFor(entry),
            };
          }
          return { code: ref, title: ref, credits: null, meta: undefined };
        });

        const optionRanges = optionItems
          .map((item) => item.credits)
          .filter(
            (parsed): parsed is { min: number; max: number } => parsed !== null,
          );

        const totalOptions = optionRanges.length;
        const rawMinChoices = row.minChoices ?? 1;
        const rawMaxChoices = row.maxChoices ?? Math.max(1, rawMinChoices);
        const minChoices = clamp(rawMinChoices, 0, totalOptions);
        const maxChoices = clamp(rawMaxChoices, minChoices, totalOptions);

        // Cheapest N options set the floor, priciest N set the ceiling.
        const byMin = [...optionRanges].sort((a, b) => a.min - b.min);
        const byMax = [...optionRanges].sort((a, b) => b.max - a.max);
        const optionMin = byMin
          .slice(0, minChoices)
          .reduce((sum, item) => sum + item.min, 0);
        const optionMax = byMax
          .slice(0, maxChoices)
          .reduce((sum, item) => sum + item.max, 0);

        termMin += optionMin;
        termMax += optionMax;

        return {
          kind: "options",
          label: row.optionLabel || "Choose one",
          minChoices,
          maxChoices,
          options: optionItems.map((item) => ({
            code: item.code,
            title: splitNoteLinks(item.title),
            meta: item.meta,
          })),
          creditsText:
            totalOptions > 0
              ? fmtRange(optionMin, optionMax)
              : row.creditsOverride || "",
        };
      }

      const entry = resolveCourse(row.course);
      const code = row.codeOverride || entry?.data.code || row.course || "";
      const courseTitle = row.titleOverride || entry?.data.title || "";
      const creditsText = row.creditsOverride || entry?.data.credits || "";
      const parsed = parseCredits(creditsText);
      if (parsed) {
        termMin += parsed.min;
        termMax += parsed.max;
      }

      return {
        kind: "course",
        code,
        title: splitNoteLinks(courseTitle),
        creditsText,
        meta: entry ? metaFor(entry) : undefined,
      };
    });

    return {
      termLabel: term.termLabel || "Term",
      rows: displayRows,
      total: fmtRange(termMin, termMax),
      termMin,
      termMax,
    };
  });

  const programMin = terms.reduce((sum, term) => sum + term.termMin, 0);
  const programMax = terms.reduce((sum, term) => sum + term.termMax, 0);

  return {
    title: input.title || "Program of Study",
    showTotals: input.showTotals ?? true,
    terms,
    notes,
    noteMap,
    programMin,
    programMax,
    totalCredits: fmtRange(programMin, programMax),
  };
}
