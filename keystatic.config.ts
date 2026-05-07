import { config, fields, collection } from "@keystatic/core";

export default config({
  storage: {
    kind: "local",
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
      slugField: "title",
      path: "src/content/2026-2027/courses/*",
      format: { contentField: "content" },
      columns: ["title", "category", "credits"],
      schema: {
        title: fields.slug({ name: { label: "Title" } }),
        code: fields.text({ label: "Course Code" }),
        category: fields.text({ label: "Category" }),
        credits: fields.text({ label: "Credits" }),
        prerequisites: fields.array(
          fields.relationship({
            label: "Prerequisites",
            collection: "courses_2026",
          }),
          {
            label: "Prerequisites",
            itemLabel: (props) => props.value,
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
            itemLabel: (props) => props.value,
          },
        ),
        corequisiteNote: fields.text({
          label: "Corequisite Note",
          description: "Additional notes about corequisites",
        }),
        content: fields.markdoc({
          label: "Content",
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
