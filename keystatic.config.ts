import { config, fields, collection } from "@keystatic/core";
import { block, inline } from "@keystatic/core/content-components";

const markdocComponents = {
  br: inline({
    label: "Line Break",
    schema: {},
  }),
  programofstudy: block({
    label: "Program of Study",
    schema: {
      title: fields.text({
        label: "Title",
        defaultValue: "Program of Study",
      }),
      showTotals: fields.checkbox({
        label: "Show total credits",
        defaultValue: true,
      }),
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
                  "Optional custom title text for this row instead of the selected course title.",
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
                  return note ? `Note: ${String(note).slice(0, 32)}` : "Note row";
                }
                if (rowType === "options") {
                  const optionLabel = props.fields.optionLabel.value;
                  return optionLabel ? `Options: ${optionLabel}` : "Option group";
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
