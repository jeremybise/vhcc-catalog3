import { config, fields, collection } from "@keystatic/core";
import { block, inline } from "@keystatic/core/content-components";
import { createElement as h } from "react";

const markdocComponents = {
  br: inline({
    label: "Line Break",
    schema: {},
  }),
  coursetooltip: inline({
    label: "Course Tooltip",
    schema: {
      code: fields.relationship({
        label: "Course",
        collection: "courses_2026",
      }),
      label: fields.text({
        label: "Display label",
        description: "Optional label text instead of course code.",
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
        defaultValue: "Program of Study",
      }),
      showTotals: fields.checkbox({
        label: "Show total credits",
        defaultValue: true,
      }),
      notes: fields.array(
        fields.object({
          number: fields.integer({
            label: "Note number",
            validation: { min: 1 },
          }),
          text: fields.text({
            label: "Note text",
            multiline: true,
          }),
        }),
        {
          label: "Program notes",
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
            defaultValue: "Semester",
          }),
          rows: fields.array(
            fields.object({
              rowType: fields.select({
                label: "Row type",
                options: [
                  { label: "Course", value: "course" },
                  { label: "Option group (choose from)", value: "options" },
                  { label: "Note row", value: "note" },
                ],
                defaultValue: "course",
              }),
              course: fields.relationship({
                label: "Course",
                collection: "courses_2026",
              }),
              codeOverride: fields.text({
                label: "Course code override",
                description:
                  "Optional custom course number for non-catalog rows (for example EEE or MTH or SCI).",
              }),
              titleOverride: fields.text({
                label: "Title override",
                description:
                  "Optional custom title text for this row instead of the selected course title. Use [1], [2], etc. to link to program notes.",
              }),
              creditsOverride: fields.text({
                label: "Credits override",
                description:
                  "Optional credit display override (for example 3-4 or 1-2).",
              }),
              optionLabel: fields.text({
                label: "Option label",
                defaultValue: "Choose one",
              }),
              minChoices: fields.integer({
                label: "Minimum choices",
                defaultValue: 1,
                validation: { min: 0 },
              }),
              maxChoices: fields.integer({
                label: "Maximum choices",
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
                  itemLabel: (props) => props.value ?? "",
                },
              ),
              note: fields.text({
                label: "Note",
                multiline: true,
              }),
            }),
            {
              label: "Rows",
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
    schema: {
      title: fields.text({
        label: "Title",
        description: "Heading shown above the generated links.",
      }),
      includeIndex: fields.checkbox({
        label: "Include index page",
        defaultValue: false,
      }),
      variant: fields.select({
        label: "Variant",
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
        code: fields.slug({ name: { label: "Course Code" } }),
        title: fields.text({ label: "Title" }),
        category: fields.text({ label: "Category" }),
        credits: fields.text({ label: "Credits" }),
        prerequisites: fields.array(
          fields.relationship({
            label: "Prerequisites",
            collection: "courses_2026",
          }),
          {
            label: "Prerequisites",
            itemLabel: (props) => props.value ?? "",
          },
        ),
        prerequisiteNote: fields.text({
          label: "Prerequisite Note",
          description: "Additional notes about prerequisites",
        }),
        corequisites: fields.array(
          fields.relationship({
            label: "Corequisites",
            collection: "courses_2026",
          }),
          {
            label: "Corequisites",
            itemLabel: (props) => props.value ?? "",
          },
        ),
        corequisiteNote: fields.text({
          label: "Corequisite Note",
          description: "Additional notes about corequisites",
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
  },
});
