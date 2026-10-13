/**
 * Where each page of the repository is published on the site. The English pages in scope of the
 * French documentation (pipeline/monorepo/translations.mjs) are the pages of the site: each one
 * has a route, and its French page has the same route under /fr/.
 */
import path from 'node:path';

export const REPOSITORY = 'https://github.com/gbourgeat/ddd-ts-kit';
export const SITE = 'https://gbourgeat.github.io';
export const BASE = '/ddd-ts-kit';

/** The pages that are not where their directory says: the root pages and the reference documents. */
const FIXED_ROUTES = new Map([
  ['README.md', 'start'],
  ['CONTRIBUTING.md', 'contributing'],
  ['SECURITY.md', 'contributing/security'],
  ['CODE_OF_CONDUCT.md', 'contributing/code-of-conduct'],
  ['docs/README.md', 'documentation'],
  ['docs/ARCHITECTURE.md', 'architecture'],
  ['docs/CONFIG.md', 'config'],
  ['docs/translation.md', 'contributing/translation'],
  ['examples/README.md', 'example'],
]);

/** A directory of pages, and the route its pages are published under. The first that matches wins. */
const DIRECTORY_ROUTES = [
  [/^docs\/(concepts|tools|guides|proposals)\/(.+)$/, (section, rest) => `${section}/${rest}`],
  [/^packages\/eslint-plugin\/docs\/rules\/(.+)$/, (rest) => `rules/${rest}`],
  [/^packages\/([^/]+)\/README\.md$/, (name) => `packages/${name}`],
  [/^packages\/([^/]+)\/docs\/(.+)$/, (name, rest) => `packages/${name}/${rest}`],
  [/^examples\/([^/]+)\/README\.md$/, (name) => `example/${name}`],
  [/^examples\/([^/]+)\/docs\/(.+)$/, (name, rest) => `example/${name}/${rest}`],
];

/**
 * The route of an English page, without locale and without slashes around it (`concepts/aggregates`),
 * or undefined when the page has none: a README is the page of its directory.
 */
export function routeOf(english) {
  const fixed = FIXED_ROUTES.get(english);

  if (fixed !== undefined) {
    return fixed;
  }

  for (const [pattern, route] of DIRECTORY_ROUTES) {
    const match = pattern.exec(english);

    if (match !== null) {
      return withoutReadme(route(...match.slice(1)));
    }
  }

  return undefined;
}

/** The path of a route on the site, base included, with a trailing slash: `/ddd-ts-kit/fr/concepts/aggregates/`. */
export function hrefOf(route, locale) {
  const parts = [BASE, locale === 'fr' ? 'fr' : '', route].filter((part) => part !== '');

  return `${parts.join('/')}/`;
}

/** The content file of a route for a locale, relative to the content directory. */
export function contentFileOf(route, locale, parents) {
  const localized = locale === 'fr' ? `fr/${route}` : route;

  return parents.has(route) ? `${localized}/index.md` : `${localized}.md`;
}

/** The routes that other routes nest under: their pages are written as `index.md` of a directory. */
export function parentRoutes(routes) {
  return new Set(routes.filter((route) => routes.some((other) => other.startsWith(`${route}/`))));
}

export function localeOf(page) {
  return page.endsWith('.fr.md') ? 'fr' : 'en';
}

export function githubBlob(file) {
  return `${REPOSITORY}/blob/main/${file}`;
}

export function githubTree(directory) {
  return `${REPOSITORY}/tree/main/${directory}`;
}

export function githubEdit(file) {
  return `${REPOSITORY}/edit/main/${file}`;
}

function withoutReadme(route) {
  const bare = route.replace(/\.md$/, '');

  return path.posix.basename(bare) === 'README' ? path.posix.dirname(bare) : bare;
}
