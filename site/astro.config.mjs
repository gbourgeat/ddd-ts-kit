// The documentation website of ddd-ts-kit. Its pages are assembled from the Markdown files of the
// repository by scripts/assemble.mjs, which runs before every build; the sidebar is read from the
// same files by scripts/navigation.mjs.
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightLinksValidator from 'starlight-links-validator';
import { sidebar } from './scripts/navigation.mjs';
import { BASE, REPOSITORY, SITE } from './scripts/routes.mjs';

const REPOSITORY_ROOT = new URL('..', import.meta.url).pathname;

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'always',
  // As GitHub renders them: straight quotes, and `--flag` stays two hyphens instead of becoming a dash.
  markdown: { smartypants: false },
  vite: {
    // The workspace hoists cookie 0.7 for other packages; the prerendered pages bundle the cookie 2 of Astro.
    environments: { prerender: { resolve: { noExternal: ['cookie'] } } },
    // Mermaid is the large chunk, loaded only by a page that shows a mermaid diagram.
    build: { chunkSizeWarningLimit: 4096 },
  },
  integrations: [
    starlight({
      title: 'ddd-ts-kit',
      description:
        'Domain-Driven Design, Clean Architecture and Clean Code for TypeScript backends, held by tools rather than by good intentions.',
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        fr: { label: 'Français', lang: 'fr' },
      },
      social: [{ icon: 'github', label: 'GitHub', href: REPOSITORY }],
      // Every page names its source file with `editUrl`: the content of the site is generated.
      editLink: { baseUrl: `${REPOSITORY}/edit/main/` },
      lastUpdated: false,
      sidebar: sidebar(REPOSITORY_ROOT),
      customCss: ['./src/styles/custom.css'],
      components: { Head: './src/components/Head.astro' },
      // A broken link or anchor between pages fails the build. A package README shows the
      // address of a local tool (http://localhost:8000): that one is meant.
      plugins: [starlightLinksValidator({ errorOnInvalidHashes: true, errorOnLocalLinks: false })],
    }),
  ],
});
