# Program of Study JSON API

Read-only JSON endpoints that expose the catalog's program-of-study tables so
other sites (the VHCC marketing site) can present the same data without
re-authoring it.

The endpoints are **prerendered at build time** — they're plain `.json` files in
`dist/`, served by Netlify like any other static asset. There is no server
runtime involved, and `output: "static"` in `astro.config.mjs` stays as-is.

## Endpoints

| Endpoint | Contents |
| --- | --- |
| `GET /api/<year>/programs.json` | Index of every program in a catalog year. No course descriptions. |
| `GET /api/<year>/programs/<page-slug>/<program-slug>.json` | One program, fully resolved. |

`<year>` is the catalog year folder name (`2026-2027`). Years are discovered
automatically from content — a new catalog year needs no changes here, though a
year only appears once its pages use `{% programofstudy %}` tags. (`2025-2026`
predates the tag and is therefore not covered.)

`<page-slug>` is the catalog page the program is authored on, and
`<program-slug>` is the slugified heading above the table — the same slug the
catalog page uses as its heading anchor. Don't construct these by hand; read
`endpoint` off the index.

### Index response

```jsonc
{
  "apiVersion": 1,
  "year": "2026-2027",
  "programCount": 82,
  "awards": [{ "key": "AS", "label": "Associates of Science (AS)", "count": 18 }],
  "programs": [
    {
      "year": "2026-2027",
      "name": "Associate of Science (AS) in Business Administration",
      "slug": "associate-of-science-as-in-business-administration",
      "award": "AS",                    // AA | AS | AAS | C | CSC, or null
      "awardLabel": "Associates of Science (AS)",
      "section": "school-of-business-and-industry",
      "page": {
        "slug": "business-program",
        "title": "Business Program",
        "path": "/2026-2027/school-of-business-and-industry/business-program"
      },
      "catalogPath": "/2026-2027/school-of-business-and-industry/business-program#associate-of-science-as-in-business-administration",
      "credits": { "min": 62, "max": 62, "display": "62" },
      "trackCount": 1,
      "endpoint": "/api/2026-2027/programs/business-program/associate-of-science-as-in-business-administration.json"
    }
  ]
}
```

`award` is `null` for the handful of programs that aren't one of the five award
types (e.g. "Uniform Certificate of General Studies (UCGS)").

### Program response

Everything in the index entry, plus:

```jsonc
{
  "credits": { "min": 58, "max": 69, "display": "58-69" },  // range across all tracks
  "tracks": [
    {
      "title": "Track 1 – Traditional Day Program",
      "credits": { "min": 69, "max": 69, "display": "69" },
      "terms": [
        {
          "termLabel": "First Semester (Fall)",
          "credits": { "min": 16, "max": 16, "display": "16" },
          "rows": [
            {
              "kind": "course",
              "code": "SDV-101",           // as displayed
              "title": "Orientation to College Success",
              "titleParts": [ { "kind": "text", "text": "Orientation to College Success" } ],
              "credits": "1",
              "resolved": true             // true → look it up in `courses`
            },
            {
              "kind": "options",
              "label": "Select one history course",
              "choose": { "min": 1, "max": 1 },
              "credits": "3",              // credit range the choice contributes
              "options": [ /* same shape as a course row, minus `credits` */ ]
            },
            { "kind": "note", "text": "Free-text row spanning the table" }
          ]
        }
      ],
      "notes": [
        {
          "number": 1,
          "text": "See UCGS Block II, parts A & B.",
          "parts": [ { "kind": "text", "text": "See UCGS Block II, parts A & B." } ]
        }
      ]
    }
  ],
  "courses": {
    "SDV-101": {
      "code": "SDV-101",
      "title": "Orientation to College Success",
      "credits": "1",
      "description": "Introduces students to…"
    }
  }
}
```

Notes on the shape:

- **Rows are one of three kinds.** Switch on `kind` — `course`, `options`, or
  `note`. New kinds would be a breaking change and would bump `apiVersion`.
- **`courses` is a dictionary, not a list**, keyed by course code, holding every
  course referenced anywhere in the program. Course descriptions are stored once
  there rather than repeated on each row that references them. A row with
  `resolved: true` is guaranteed to have an entry; `resolved: false` means the
  row is an editor placeholder like `"BUS EEE"` or `"ART/HUM/MUS"` with no
  matching course. If a row carries a `courseCode` field, use that as the
  dictionary key instead of `code` (an authored code override).
- **`credits` is a string on rows, an object on terms/tracks/programs.** Row
  credits are whatever the catalog displays (`"3"`, `"1-2"`, or `""`); the
  objects carry parsed `min`/`max` plus a `display` string. Option groups
  contribute their cheapest `choose.min` options to `min` and priciest
  `choose.max` to `max`.
- **`titleParts` carries footnote markers.** A course title authored as
  `Approved Business Elective[2]` yields a `text` part and a
  `{ "kind": "footnote", "footnote": 2 }` part, referencing `notes[].number` in
  the same track. Use `title` instead if you'd rather ignore footnotes — it's the
  plain text with markers stripped.
- **`tracks` is usually length 1.** Programs offered on multiple paths return one
  entry per path (nursing has four: day, LPN-to-RN, evening/weekend, evening
  LPN-to-RN), and they can differ in term count and total credits.
- **`notes[].parts`** may contain `{ "kind": "course", "code": "…", "label": "…" }`
  where the catalog renders an inline course tooltip. Render the label (or code)
  as text if you don't want a tooltip of your own.
- **`catalogUrl`** is a fully qualified link to the program's heading on the
  catalog site, for linking back. It comes from `site` in `astro.config.mjs`,
  which reads Netlify's `URL` build variable, so it tracks the catalog's primary
  domain automatically. `catalogPath` is the same thing minus the origin.

## Consuming from the marketing site

Fetch at **build time**. No CORS involved, nothing shipped to the browser, and
the marketing site keeps full control of presentation:

```astro
---
// src/pages/programs/[slug].astro — on the marketing site
const CATALOG = "https://catalog.vhcc.edu"; // the catalog site's origin
const YEAR = "2026-2027";

export async function getStaticPaths() {
  const index = await fetch(`${CATALOG}/api/${YEAR}/programs.json`).then((r) => r.json());
  return index.programs
    .filter((program) => program.award === "AAS")
    .map((program) => ({
      params: { slug: program.slug },
      props: { endpoint: program.endpoint },
    }));
}

const { endpoint } = Astro.props;
const program = await fetch(`${CATALOG}${endpoint}`).then((r) => r.json());
const [track] = program.tracks;
---

<h1>{program.name}</h1>
<p>{program.credits.display} credits</p>

{track.terms.map((term) => (
  <section>
    <h2>{term.termLabel} — {term.credits.display} credits</h2>
    <ul>
      {term.rows.map((row) =>
        row.kind === "note" ? (
          <li>{row.text}</li>
        ) : row.kind === "options" ? (
          <li>
            {row.label}: {row.options.map((o) => o.code).join(" or ")} ({row.credits} cr)
          </li>
        ) : (
          <li>
            {row.code} — {row.title} ({row.credits} cr)
            {row.resolved && <p>{program.courses[row.courseCode ?? row.code].description}</p>}
          </li>
        ),
      )}
    </ul>
  </section>
))}
```

The trade-off is that the marketing site needs a rebuild to pick up catalog
edits. Chain a Netlify build hook from the catalog site's deploy if that matters.

If you'd rather fetch in the browser instead, the endpoints send
`Access-Control-Allow-Origin: *` (declared in [public/_headers](../public/_headers),
since Netlify serves the static output rather than the Astro route handlers).

## Where this lives

| File | Role |
| --- | --- |
| [src/lib/programOfStudy.ts](../src/lib/programOfStudy.ts) | Course resolution, credit math, footnote parsing. Shared with the rendering component. |
| [src/lib/programSources.ts](../src/lib/programSources.ts) | Finds `{% programofstudy %}` tags in Markdoc bodies and pairs them with their heading. |
| [src/lib/programJson.ts](../src/lib/programJson.ts) | Serialization to the shapes above. |
| [src/pages/api/\[year\]/programs.json.ts](../src/pages/api/[year]/programs.json.ts) | Index endpoint. |
| [src/pages/api/\[year\]/programs/\[...program\].json.ts](../src/pages/api/[year]/programs/[...program].json.ts) | Per-program endpoint. |

The credit math is deliberately **not** duplicated in the endpoints — both
[src/components/ProgramOfStudy.astro](../src/components/ProgramOfStudy.astro) and
the endpoints call `processProgram()` from `src/lib/programOfStudy.ts`, so the
totals a consumer reads are computed by the same code that rendered the catalog
page. If you change credit handling, change it there.
