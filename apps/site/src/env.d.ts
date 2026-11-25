/// <reference types="astro/client" />

// `process` is only read at build time from `.astro` frontmatter; declaring it
// here keeps the site from depending on @types/node just for that.
declare const process: { env: Record<string, string | undefined> };
