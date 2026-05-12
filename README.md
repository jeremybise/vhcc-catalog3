# VHCC Course Catalog

## Tech Stack

- Custom Astro app
- Markdoc for catalog and course pages
  - Program of Study component
  - Course Tooltip component
- Keystatic CMS for editors
- Netlify or Vercel or Node for hosting?

## New Year Process

1. Create a new branch (i.e. 2020-2021) for isolation and preview while working on the next catalog
2. Duplicate as 2020-2021 as a starting point for the new catalog
3. Add new years for courses and catalog to Astro content config (src/content/config.ts)
4. Add new years for courses and catalog to Keystatic config (keystatic.config.mjs)
5. Mark the previous year as archived by setting `archived: true` in the index.mdoc for the previous year
6. Publish branch to Github so editors can work via Keystatic. Preview will be available at ???
7. When they're ready to publish, merge that branch into master and push
