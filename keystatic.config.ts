import { config, fields, collection } from "@keystatic/core";
import { block, inline } from "@keystatic/core/content-components";
import { createElement as h } from "react";

const markdocComponents = {
  br: inline({
    label: "Line Break",
    description: "Forces a line break within a paragraph, without starting a new one.",
    schema: {},
  }),
  coursetooltip: inline({
    label: "Course Tooltip",
    description:
      "An inline, clickable course reference. Shows the course code (or a custom label) with a hover/click popover containing its real title, credits, and description.",
    schema: {
      code: fields.relationship({
        label: "Course",
        description:
          "The course this tooltip links to. Its title, credits, and description are pulled live from that course's own page.",
        collection: "courses_2026",
      }),
      label: fields.text({
        label: "Display label",
        description:
          'Text shown instead of the course code (e.g. "Intro to Programming" instead of "CSC-221"). Leave blank to show the course code itself.',
      }),
    },
  }),
  programofstudy: block({
    label: "Program of Study",
    ContentView: ({ value }) => {
      const { title, terms = [], notes = [] } = value;
      return h(
        "div",
        {
          style: {
            fontFamily: "sans-serif",
            fontSize: "13px",
            lineHeight: "1.5",
          },
        },
        h(
          "strong",
          { style: { display: "block", marginBottom: "6px" } },
          title || "Program of Study",
        ),
        ...(terms.length === 0
          ? [h("em", { style: { color: "#888" } }, "No terms added yet")]
          : terms.map((term, i) =>
              h(
                "div",
                { key: i, style: { marginBottom: "8px" } },
                h(
                  "div",
                  {
                    style: {
                      fontWeight: "600",
                      borderBottom: "1px solid currentColor",
                      marginBottom: "3px",
                      paddingBottom: "2px",
                      opacity: 0.7,
                    },
                  },
                  term.termLabel || `Semester ${i + 1}`,
                ),
                ...(term.rows ?? []).map((row, j) => {
                  if (row.rowType === "note") {
                    return h(
                      "div",
                      {
                        key: j,
                        style: {
                          paddingLeft: "10px",
                          fontStyle: "italic",
                          opacity: 0.6,
                          fontSize: "12px",
                        },
                      },
                      String(row.note ?? "").slice(0, 80) || "Note",
                    );
                  }
                  if (row.rowType === "options") {
                    const codes = (row.options ?? [])
                      .filter(Boolean)
                      .join(", ");
                    return h(
                      "div",
                      { key: j, style: { paddingLeft: "10px", opacity: 0.8 } },
                      `${row.optionLabel || "Choose one"}: `,
                      h("em", null, codes || "no options selected"),
                    );
                  }
                  const code = row.course ?? row.codeOverride ?? "";
                  return h(
                    "div",
                    {
                      key: j,
                      style: {
                        paddingLeft: "10px",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "8px",
                      },
                    },
                    h(
                      "span",
                      null,
                      code ||
                        h(
                          "em",
                          { style: { opacity: 0.5 } },
                          "no course selected",
                        ),
                    ),
                    row.creditsOverride
                      ? h(
                          "span",
                          { style: { opacity: 0.6, flexShrink: 0 } },
                          row.creditsOverride,
                        )
                      : null,
                  );
                }),
              ),
            )),
        ...(notes.length > 0
          ? [
              h(
                "div",
                {
                  style: {
                    marginTop: "10px",
                    borderTop: "1px solid currentColor",
                    paddingTop: "6px",
                    opacity: 0.75,
                  },
                },
                h(
                  "div",
                  { style: { fontWeight: "600", marginBottom: "4px" } },
                  "Notes",
                ),
                ...notes.map((note, i) =>
                  h(
                    "div",
                    {
                      key: i,
                      style: {
                        display: "flex",
                        gap: "6px",
                        marginBottom: "2px",
                      },
                    },
                    note.number != null
                      ? h(
                          "span",
                          { style: { flexShrink: 0, fontWeight: "600" } },
                          `${note.number}.`,
                        )
                      : null,
                    h(
                      "span",
                      null,
                      String(note.text ?? "").slice(0, 100) ||
                        h("em", null, "empty note"),
                    ),
                  ),
                ),
              ),
            ]
          : []),
      );
    },
    schema: {
      title: fields.text({
        label: "Title",
        description: "Heading printed above the whole table, e.g. \"Course of Study.\"",
        defaultValue: "Program of Study",
      }),
      showTotals: fields.checkbox({
        label: "Show total credits",
        description:
          "Adds a Total row to each term's table and a grand total line under the whole program.",
        defaultValue: true,
      }),
      notes: fields.array(
        fields.object({
          number: fields.integer({
            label: "Note number",
            description:
              "The number shown in the footnote list. Match this to the [1], [2], etc. you type into a row's title below.",
            validation: { min: 1 },
          }),
          text: fields.text({
            label: "Note text",
            description:
              'Footnote text shown at the bottom of the table. To reference a course inside it, type {% coursetooltip code="ABC-123" /%}.',
            multiline: true,
          }),
        }),
        {
          label: "Program notes",
          description:
            "Numbered footnotes for the whole program, printed below the table. Rows link to these using [1], [2], etc. in a title.",
          itemLabel: (props) => {
            const number = props.fields.number.value;
            const text = props.fields.text.value;
            if (number) return `Note ${number}`;
            if (text) return `Note: ${String(text).slice(0, 24)}`;
            return "Note";
          },
        },
      ),
      terms: fields.array(
        fields.object({
          termLabel: fields.text({
            label: "Term label",
            description:
              'Heading for this semester\'s table, e.g. "First Semester (Fall)."',
            defaultValue: "Semester",
          }),
          rows: fields.array(
            fields.object({
              rowType: fields.select({
                label: "Row type",
                description:
                  "Course = one course in the table. Option group = a \"choose N of these\" group. Note row = a plain instructional line spanning the row.",
                options: [
                  { label: "Course", value: "course" },
                  { label: "Option group (choose from)", value: "options" },
                  { label: "Note row", value: "note" },
                ],
                defaultValue: "course",
              }),
              course: fields.relationship({
                label: "Course",
                description:
                  "Pulls this course's real title and credits from the catalog. Leave blank and use the overrides below for a non-catalog row.",
                collection: "courses_2026",
              }),
              codeOverride: fields.text({
                label: "Course code override",
                description:
                  "Custom course number shown instead of a picked course, for rows that aren't a real catalog course (for example EEE or MTH or SCI).",
              }),
              titleOverride: fields.text({
                label: "Title override",
                description:
                  "Custom title shown instead of the picked course's title. Add [1], [2], etc. to link to a program note below.",
              }),
              creditsOverride: fields.text({
                label: "Credits override",
                description:
                  "Custom credit text shown instead of the picked course's credits (for example 3-4 or 1-2).",
              }),
              optionLabel: fields.text({
                label: "Option label",
                description:
                  'Instruction printed above the choices, e.g. "Select one mathematics course."',
                defaultValue: "Choose one",
              }),
              minChoices: fields.integer({
                label: "Minimum choices",
                description:
                  "How many of the options below a student must take. Sets the low end of this row's credit range.",
                defaultValue: 1,
                validation: { min: 0 },
              }),
              maxChoices: fields.integer({
                label: "Maximum choices",
                description:
                  "The most options below that count toward credits. Sets the high end of this row's credit range.",
                defaultValue: 1,
                validation: { min: 1 },
              }),
              options: fields.array(
                fields.relationship({
                  label: "Option course",
                  collection: "courses_2026",
                }),
                {
                  label: "Option courses",
                  description: "The courses a student can choose between for this group.",
                  itemLabel: (props) => props.value ?? "",
                },
              ),
              note: fields.text({
                label: "Note",
                description:
                  "Plain text shown across the full row width. No course lookup or credit math is applied to it.",
                multiline: true,
              }),
            }),
            {
              label: "Rows",
              description:
                "The courses (or choices) for this term, in the order they'll appear in the table.",
              itemLabel: (props) => {
                const rowType = props.fields.rowType.value;
                if (rowType === "note") {
                  const note = props.fields.note.value;
                  return note
                    ? `Note: ${String(note).slice(0, 32)}`
                    : "Note row";
                }
                if (rowType === "options") {
                  const optionLabel = props.fields.optionLabel.value;
                  return optionLabel
                    ? `Options: ${optionLabel}`
                    : "Option group";
                }
                const course = props.fields.course.value;
                if (course) {
                  return `Course: ${course}`;
                }
                const codeOverride = props.fields.codeOverride.value;
                if (codeOverride) {
                  return `Course: ${codeOverride}`;
                }
                return "Course row";
              },
            },
          ),
        }),
        {
          label: "Terms",
          description:
            "One entry per semester. Each becomes its own table on the page, with its own credit total.",
          itemLabel: (props) => {
            const termLabel = props.fields.termLabel.value;
            return termLabel ? `Term: ${termLabel}` : "Term";
          },
        },
      ),
    },
  }),
  sectiontoc: block({
    label: "Section TOC",
    description:
      "Auto-generates a list of links to the other pages in this same section — nothing to maintain by hand, it always reflects whatever pages currently exist.",
    schema: {
      title: fields.text({
        label: "Title",
        description:
          "Heading shown above the generated links. Leave blank for no heading.",
      }),
      includeIndex: fields.checkbox({
        label: "Include index page",
        description:
          "Also list this section's own index/landing page in the links (usually left off, since it's the page this block is already placed on).",
        defaultValue: false,
      }),
      variant: fields.select({
        label: "Variant",
        description:
          "List = a plain bullet list of links. Cards = boxed link tiles arranged in a grid.",
        options: [
          { label: "List", value: "list" },
          { label: "Cards", value: "cards" },
        ],
        defaultValue: "list",
      }),
    },
  }),
};

export default config({
  storage: {
    kind: "github",
    repo: {
      owner: "jeremybise",
      name: "vhcc-catalog3",
    },
  },
  collections: {
    catalog_2026: collection({
      label: "2026-2027 Catalog",
      slugField: "title",
      path: "src/content/2026-2027/catalog/**",
      format: { contentField: "content" },
      columns: ["title"],
      parseSlugForSort: (slug) => slug,
      schema: {
        title: fields.slug({ name: { label: "Title" } }),
        order: fields.number({
          label: "Order",
          description:
            "Position within the section (lower = first in sidebar). Leave blank to sort last.",
        }),
        content: fields.markdoc({
          label: "Content",
          components: markdocComponents,
          options: {
            image: {
              directory: "src/assets/",
              publicPath: "../../assets/",
            },
          },
        }),
      },
    }),
    courses_2026: collection({
      label: "2026-2027 Courses",
      slugField: "code",
      path: "src/content/2026-2027/courses/*",
      format: { contentField: "content" },
      columns: ["code", "title", "category", "credits"],
      schema: {
        code: fields.slug({
          name: {
            label: "Course Code",
            description:
              'The course number, e.g. "CSC-221." This is how the course is referenced everywhere else — in Course Tooltips, Program of Study rows, and prerequisite/corequisite lists.',
          },
        }),
        title: fields.text({
          label: "Title",
          description:
            "Full course name. Shown on this course's own page and everywhere it's referenced (tooltips, program tables, course descriptions).",
        }),
        category: fields.text({
          label: "Category",
          description:
            'Groups this course under the matching page in Course Descriptions, e.g. "computer-science" or "machine-technology." Must exactly match that page\'s URL slug (lowercase, hyphenated) or this course won\'t show up there.',
        }),
        credits: fields.text({
          label: "Credits",
          description:
            'Credit hours shown wherever this course appears. A plain number ("3") or a range ("3-4") for variable-credit courses — ranges are used in Program of Study credit totals.',
        }),
        prerequisites: fields.array(
          fields.relationship({
            label: "Prerequisites",
            collection: "courses_2026",
          }),
          {
            label: "Prerequisites",
            description:
              "Other courses that must be completed before this one. Shown on this course's own page.",
            itemLabel: (props) => props.value ?? "",
          },
        ),
        prerequisiteNote: fields.text({
          label: "Prerequisite Note",
          description:
            'Extra prerequisite text shown alongside the list above (e.g. "or divisional approval").',
        }),
        corequisites: fields.array(
          fields.relationship({
            label: "Corequisites",
            collection: "courses_2026",
          }),
          {
            label: "Corequisites",
            description:
              "Other courses that must be taken at the same time as this one. Shown on this course's own page.",
            itemLabel: (props) => props.value ?? "",
          },
        ),
        corequisiteNote: fields.text({
          label: "Corequisite Note",
          description:
            "Extra corequisite text shown alongside the list above.",
        }),
        content: fields.markdoc({
          label: "Content",
          description:
            "The course description. Shown on this course's own page, in Course Tooltip popovers, and in the Course Descriptions section.",
          components: markdocComponents,
          options: {
            image: {
              directory: "src/assets/",
              publicPath: "../../assets/",
            },
          },
        }),
      },
    }),
  },
});
