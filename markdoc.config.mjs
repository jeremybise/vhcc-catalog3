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
        terms: { type: Array },
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
  },
});
