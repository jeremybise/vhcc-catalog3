import Markdoc from "@markdoc/markdoc";
import { getCollection } from "astro:content";
import { slugify, type ProgramInput } from "./programOfStudy";

/**
 * Discovery of `{% programofstudy %}` tables across a catalog year.
 *
 * Program tables aren't frontmatter — they're authored inline in the Markdoc
 * body, and a single page holds several of them (7 on business-program.mdoc).
 * The program's *name* isn't on the tag either; it's the heading above it, so
 * we re-parse the body and pair each tag with its nearest preceding heading.
 * Consecutive tables under one heading are alternate tracks of the same program
 * (nursing has four: day, LPN-to-RN, evening/weekend, evening LPN-to-RN).
 */

export type AwardKey = "AA" | "AS" | "AAS" | "C" | "CSC";

export const awardMeta: { key: AwardKey; title: string }[] = [
  { key: "AA", title: "Associates of Arts (AA)" },
  { key: "AS", title: "Associates of Science (AS)" },
  { key: "AAS", title: "Associates of Applied Science (AAS)" },
  { key: "C", title: "Certificates (C)" },
  { key: "CSC", title: "Career Studies Certificates (CSC)" },
];

/**
 * Classify a degree/certificate heading by its award type.
 *
 * Drives the on-page links in [src/components/CoursesOfStudyLinks.astro], so
 * keep it strict — a looser match here silently adds entries to those lists.
 */
export const getAward = (heading: string): AwardKey | null => {
  if (/^associate of arts\b/i.test(heading)) return "AA";
  if (/^associate of science\b/i.test(heading)) return "AS";
  if (/^associate of applied science\b/i.test(heading)) return "AAS";
  if (/^certificate\b/i.test(heading)) return "C";
  if (/^career studies certificate\b/i.test(heading)) return "CSC";
  return null;
};

/**
 * Award classification for the JSON endpoints, which also accepts a
 * parenthesized award code anywhere in the heading. That catches titles the
 * strict prefix match misses — "Cooperative Career Studies Certificate (CSC) in
 * Culinary Arts" is a CSC, and a consumer filtering by award should see it.
 * Deliberately separate from `getAward` so the rendered pages don't change.
 */
export const classifyAward = (heading: string): AwardKey | null => {
  const strict = getAward(heading);
  if (strict) return strict;

  const parenthesized = heading.match(/\((AAS|AA|AS|CSC|C)\)/);
  return (parenthesized?.[1] as AwardKey | undefined) ?? null;
};

/** The three sections whose pages carry program-of-study tables. */
export const programSections = [
  "school-of-arts-and-sciences",
  "school-of-business-and-industry",
  "school-of-health-professions",
];

export interface ProgramSource {
  year: string;
  section: string;
  /** Page path within its section, e.g. "business-program". */
  pageSlug: string;
  pageTitle: string;
  /** Program name, taken from the heading above the table. */
  name: string;
  /** Slugified name — unique within the page, and the catalog page's anchor. */
  slug: string;
  award: AwardKey | null;
  /** Path to the program's heading on the catalog site. */
  catalogPath: string;
  /** Raw tag attributes, one per alternate track. */
  tracks: ProgramInput[];
}

interface HeadingInfo {
  depth: number;
  text: string;
}

const headingText = (node: any): string => {
  const chunks: string[] = [];
  for (const child of node.walk()) {
    if (child.type === "text" || child.type === "code") {
      const content = child.attributes?.content;
      if (typeof content === "string") chunks.push(content);
    }
  }
  return chunks.join("").trim();
};

/**
 * Collect every program-of-study table in a catalog year, grouped by program.
 */
export async function getProgramSources(
  year: string,
): Promise<ProgramSource[]> {
  const entries = await getCollection("catalog");
  const pages = entries
    .filter((entry) => entry.id.startsWith(`${year}/catalog/`))
    .filter((entry) => !entry.id.endsWith("/index"))
    .filter((entry) => programSections.includes(entry.id.split("/")[2] ?? ""))
    .sort((a, b) => a.id.localeCompare(b.id));

  const sources: ProgramSource[] = [];

  for (const entry of pages) {
    const parts = entry.id.split("/");
    const section = parts[2] ?? "";
    const pageSlug = parts.slice(3).join("/");
    const pageUrl = `/${year}/${section}/${pageSlug}`;

    const ast = Markdoc.parse(entry.body ?? "");

    let heading: HeadingInfo | null = null;
    let current: ProgramSource | null = null;
    let currentHeading: HeadingInfo | null = null;
    const usedSlugs = new Set<string>();

    for (const node of ast.walk()) {
      if (node.type === "heading") {
        const depth = Number(node.attributes?.level ?? 0);
        const text = headingText(node);
        // Degree/certificate titles are h2; h3 is used for subsections
        // ("Admission Requirements", "Other Requirements"), which must not be
        // mistaken for the program's name just because they sit closest to the
        // table. An h3 only wins if it names an award in its own right.
        if (depth === 2 || (depth === 3 && classifyAward(text))) {
          heading = { depth, text };
        }
        continue;
      }

      if (node.type !== "tag" || node.tag !== "programofstudy") continue;

      const track = (node.attributes ?? {}) as ProgramInput;

      // Same heading as the previous table → another track of that program.
      if (current && currentHeading === heading) {
        current.tracks.push(track);
        continue;
      }

      const name = heading?.text || entry.data.title;
      let slug = slugify(name) || "program";
      // Anchors are unique in practice, but don't let a repeated heading on one
      // page collapse two programs into the same endpoint path.
      if (usedSlugs.has(slug)) {
        let suffix = 2;
        while (usedSlugs.has(`${slug}-${suffix}`)) suffix += 1;
        slug = `${slug}-${suffix}`;
      }
      usedSlugs.add(slug);

      current = {
        year,
        section,
        pageSlug,
        pageTitle: entry.data.title,
        name,
        slug,
        award: classifyAward(name),
        catalogPath: heading ? `${pageUrl}#${slugify(heading.text)}` : pageUrl,
        tracks: [track],
      };
      currentHeading = heading;
      sources.push(current);
    }
  }

  return sources;
}

/** Catalog years that actually contain program-of-study tags. */
export async function getProgramYears(): Promise<string[]> {
  const entries = await getCollection("catalog");
  const years = new Set<string>();
  for (const entry of entries) {
    const parts = entry.id.split("/");
    const year = parts[0] ?? "";
    if (!programSections.includes(parts[2] ?? "")) continue;
    if (!(entry.body ?? "").includes("{% programofstudy")) continue;
    years.add(year);
  }
  return [...years].sort();
}
