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
        'Domain-Driven Design (DDD), Clean Architecture and Clean Code for TypeScript and Node.js backends, held by tools: CLI, runtime packages, ESLint plugin, and a plugin for Claude Code, Codex and GitHub Copilot.',
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        fr: { label: 'Français', lang: 'fr' },
      },
      social: [{ icon: 'github', label: 'GitHub', href: REPOSITORY }],
      // The card a link to any page shows when it is shared (site/src/assets/social-card.svg, rendered
      // to public/social-card.png by scripts/social-card.mjs).
      head: [
        { tag: 'meta', attrs: { property: 'og:image', content: `${SITE}${BASE}/social-card.png` } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: `${SITE}${BASE}/social-card.png` } },
      ],
      // Every page names its source file with `editUrl`: the content of the site is generated.
      editLink: { baseUrl: `${REPOSITORY}/edit/main/` },
      lastUpdated: false,
      sidebar: sidebar(REPOSITORY_ROOT),
      customCss: [
        '@fontsource-variable/ibm-plex-sans',
        '@fontsource/ibm-plex-mono/400.css',
        '@fontsource/ibm-plex-mono/500.css',
        './src/styles/theme.css',
        './src/styles/custom.css',
      ],
      components: { Head: './src/components/Head.astro' },
      // A broken link or anchor between pages fails the build. A package README shows the
      // address of a local tool (http://localhost:8000): that one is meant.
      plugins: [starlightLinksValidator({ errorOnInvalidHashes: true, errorOnLocalLinks: false })],
    }),
  ],
});
