# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the Virginia Highlands Community College (VHCC) course catalog site: a statically-generated Astro app that renders multiple years of catalog content (policies, program pages, course descriptions) authored as Markdoc, with Keystatic as the CMS editors use to author that content via GitHub storage.

## Commands

```bash
npm run dev       # astro dev — local dev server
npm run build     # astro build && pagefind --site dist — static build + search index
npm run preview   # astro preview — serve the built dist/ output
```

There is no test suite, lint script, or typecheck script configured in `package.json`. To typecheck, use `npx astro check`. There is no single-test runner since there are no tests.

Keystatic's admin UI is available at `/keystatic` when running `astro dev` (uses local mode); in production it authenticates against GitHub (see `keystatic.config.ts`'s `storage.kind: "github"`, repo `jeremybise/vhcc-catalog3`) using the env vars in `.env` (`KEYSTATIC_GITHUB_CLIENT_ID/SECRET`, `KEYSTATIC_SECRET`, `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`).

Deployment target is Netlify (`@astrojs/netlify` adapter, `output: "static"`).

## Architecture

### Multi-year content model

Everything is scoped under a catalog **year** folder like `src/content/2025-2026/` or `src/content/2026-2027/`. Three Astro content collections (defined in [src/content/config.ts](src/content/config.ts)) glob across *all* year folders at once:

- `catalog` — one entry per `.mdoc` under `<year>/catalog/**` (policy/program pages, grouped into section subfolders like `about-the-college`, `admissions`, `school-of-health-professions`, etc). Entry `id` looks like `2026-2027/catalog/about-the-college/core-values`.
- `courses` — one entry per `.mdoc` under `<year>/courses/*` (flat, one file per course, e.g. `MAC-295.mdoc`). Schema includes `code`, `category`, `credits`, `prerequisites`/`corequisites` (arrays of course codes as strings), and note fields.
- `catalogYears` — one entry per `<year>/index.mdoc`, the year's root landing page. Has an `archived: boolean` flag.

Because collection IDs always start with `<year>/...`, nearly every page/component parses `entry.id.split("/")` or `Astro.url.pathname.split("/")` to recover the year and section rather than relying on separate params. Section slugs (`about-the-college`, `course-descriptions`, etc.) are derived directly from folder names, not from a separate registry.

### Routing

Two dynamic routes drive the entire catalog:

- [src/pages/[year]/index.astro](src/pages/[year]/index.astro) — the year's landing page (renders `catalogYears` entry + a grid linking to each section).
- [src/pages/[year]/[...slug].astro](src/pages/[year]/[...slug].astro) — every other catalog page. Both files independently rebuild the same sidebar/breadcrumb/prev-next data structure from the full `catalog` collection on every request path (getStaticPaths), grouping entries by their section folder and sorting by each page's `order` frontmatter field (section order comes from that section's own `index.mdoc`).

`src/pages/index.astro` is the top-level "pick a catalog year" landing page, listing all `catalogYears` entries sorted newest-first.

**Adding a new catalog year** (per README's "New Year Process"): create a new `src/content/<year>/` folder (duplicate the previous year as a starting point), register it in both `src/content/config.ts` (globs already match any year automatically, no change usually needed there) and `keystatic.config.ts` (needs a new pair of `collection()` entries, e.g. `catalog_2027`/`courses_2027`, since Keystatic collections are NOT auto-derived from folder globs), then mark the outgoing year's `index.mdoc` with `archived: true`.

### Course descriptions special-case

The `course-descriptions` section doesn't store per-course prose in `catalog` — instead [src/components/CourseDescriptionCategory.astro](src/components/CourseDescriptionCategory.astro) is rendered in place of a leaf page's own content when `[...slug].astro` detects `currentSection === "course-descriptions"`; it pulls matching entries from the `courses` collection filtered by `category` and renders each course's own Markdoc body inline. The page's table-of-contents headings are also synthesized from these course codes/titles rather than from the page's actual Markdoc headings.

### Markdoc custom tags

Custom Markdoc tags are wired in two places that must stay in sync:
- [markdoc.config.mjs](markdoc.config.mjs) — registers tags for the Astro rendering pipeline, mapping each tag to an `.astro` component under `src/components/`.
- [keystatic.config.ts](keystatic.config.ts) — registers the *same* tags as Keystatic `content-components` (`markdocComponents`) so editors get a WYSIWYG editing form, including inline `ContentView` React previews for `programofstudy`.

Tags: `br` (line break), `coursetooltip` (inline course reference with hover/click popover, resolves against the `courses` collection for the current year), `programofstudy` (renders a semester-by-semester course table with credit totals, option groups "choose N of M", and numbered footnotes), `sectiontoc` (auto-generated list/card links to sibling pages in a section — see [src/components/SectionToc.astro](src/components/SectionToc.astro)), `coursesofstudylinks` (scans headings across the three "School of..." sections and buckets degree/certificate program links by type: AA/AS/AAS/Certificate/CSC — see [src/components/CoursesOfStudyLinks.astro](src/components/CoursesOfStudyLinks.astro)).

When editing `programofstudy` or `coursetooltip` logic, note that course lookups always resolve relative to the *current URL's year segment* (`Astro.url.pathname`), not a fixed year — so year-scoped Keystatic collections (`courses_2026`) and Keystatic `relationship` fields must be kept per-year too if a new year is added.

### Program of Study JSON API

Program tables are also exposed as prerendered JSON for external consumers (the VHCC marketing site) — `/api/<year>/programs.json` plus one file per program. See [docs/program-api.md](docs/program-api.md) for the response shapes and a consumption example.

Three points matter when touching this code:

- **Credit math is shared, not duplicated.** [src/lib/programOfStudy.ts](src/lib/programOfStudy.ts) holds course resolution, credit-range math, and footnote parsing; both [src/components/ProgramOfStudy.astro](src/components/ProgramOfStudy.astro) and the endpoints call `processProgram()`. Adding that logic back into either caller lets the catalog page and the API disagree about how many credits a degree takes.
- **Program identity comes from the heading, not the tag.** A `programofstudy` tag's `title` attribute is usually generic ("Course of Study"); the program name is the `##` above it, so [src/lib/programSources.ts](src/lib/programSources.ts) re-parses the Markdoc body with `Markdoc.parse(entry.body)` and pairs each tag with its nearest preceding h2. `###` subsections ("Admission Requirements") are deliberately skipped unless they name an award themselves, otherwise they hijack the program name. Consecutive tables under one heading are alternate **tracks** of one program (nursing has four).
- **Two award classifiers exist on purpose.** `getAward()` is the strict prefix match that drives the on-page links in `CoursesOfStudyLinks.astro`; `classifyAward()` adds a parenthesized-code fallback and is used only by the API, so broadening API classification can't silently change a rendered page.

Years are discovered from content (`getProgramYears()`), so a new catalog year needs no changes here — but a year only appears once its pages use `programofstudy` tags (`2025-2026` predates the tag and is not covered).

### Tooltip UI pattern

Course tooltips (both the standalone `CourseTooltip.astro` inline tag and the ones embedded per-row inside `ProgramOfStudy.astro`) share one hand-rolled interaction pattern implemented via `data-tooltip-*` attributes and a global `is:inline` script (guarded by `window.__vhccTooltipInit` so it only attaches once per page even though both components inject their own copy of the script). Panels are portaled to `document.body` on open so they escape table/overflow stacking contexts, and there's a shared `#tooltip-backdrop` element defined once in [src/layouts/CatalogLayout.astro](src/layouts/CatalogLayout.astro). If you touch one tooltip implementation, check whether the other needs the same fix.

### CatalogLayout

[src/layouts/CatalogLayout.astro](src/layouts/CatalogLayout.astro) is the shared shell for all catalog pages: sticky header with year switcher, dark-mode toggle (persisted to `localStorage` under `vhcc-theme`), mobile nav drawer, desktop sidebar (built from the `sidebar` prop computed in the page component, not by the layout itself), sticky/compacting title bar (via `IntersectionObserver` on a sentinel element), auto-generated heading anchor links, and responsive table wrapping — all done with vanilla inline `<script>` blocks, no client framework beyond the search box. `--header-h` / `--scroll-offset` CSS custom properties are computed at runtime and used for scroll-margin so anchor links land below the sticky bars correctly.

### Search

[src/components/CatalogSearch.tsx](src/components/CatalogSearch.tsx) is the one React island (`client:load`) in the app. It lazy-loads Pagefind (`/pagefind/pagefind.js`, generated by the `pagefind` build step, via a `new Function("return import(...)")` trick to dodge Vite's static analysis of a path that doesn't exist until after build) and filters results client-side to the current catalog year based on URL pathname. Pagefind only works against the built `dist/` output (via `npm run build` + `npm run preview`), not `astro dev`.

### Styling

Tailwind v4 via `@tailwindcss/vite` (no `tailwind.config.js` — theme customization lives in `@theme` blocks in [src/styles/global.css](src/styles/global.css): `--color-vhcc-navy`, `--color-vhcc-blue`, `--color-vhcc-green`). Dark mode uses the `dark:` variant driven by a `.dark` class on `<html>`, toggled by inline scripts in both layouts. Body copy in `content` prose uses Tailwind Typography (`@tailwindcss/typography`).
