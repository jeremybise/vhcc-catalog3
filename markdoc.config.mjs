import { component, defineMarkdocConfig, nodes } from "@astrojs/markdoc/config";

export default defineMarkdocConfig({
  nodes,
  tags: {
    br: {
      render: "br",
      selfClosing: true,
    },
    programofstudy: {
      render: component("./src/components/ProgramOfStudy.astro"),
      attributes: {
        title: { type: String },
        showTotals: { type: Boolean },
        notes: { type: Array },
        terms: { type: Array },
      },
    },
    coursetooltip: {
      render: component("./src/components/CourseTooltip.astro"),
      attributes: {
        code: { type: String },
        label: { type: String },
      },
    },
    sectiontoc: {
      render: component("./src/components/SectionToc.astro"),
      attributes: {
        title: { type: String },
        includeIndex: { type: Boolean },
        variant: { type: String },
      },
    },
    coursesofstudylinks: {
      render: component("./src/components/CoursesOfStudyLinks.astro"),
      selfClosing: true,
    },
  },
});
