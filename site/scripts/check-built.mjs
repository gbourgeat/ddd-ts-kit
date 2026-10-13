#!/usr/bin/env node
/**
 * Checks the built site (site/dist/) against the repository: every English page in scope of the
 * French documentation and its French page have their HTML page, the two home pages exist, and
 * every diagram a page shows is in the site, and no page holds an em dash or an en dash (which
 * smart punctuation would make of `--flag`). Runs after `astro build`; exits 1 on any problem.
 *
 *   node site/scripts/check-built.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { sitePages } from './assemble.mjs';
import { BASE, hrefOf } from './routes.mjs';

const SITE_ROOT = path.resolve(import.meta.dirname, '..');
const DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename) {
  const problems = builtProblems(path.resolve(SITE_ROOT, '..'), path.join(SITE_ROOT, 'dist'));

  for (const problem of problems) {
    console.error(problem);
  }

  console.log(
    problems.length === 0
      ? 'Every page in English and in French has its route in the built site, with its diagrams.'
      : `\n${problems.length} problem(s) in the built site.`,
  );
  process.exitCode = problems.length === 0 ? 0 : 1;
}

/** The problems of the site built in `dist` for the repository at `root`, one line each. */
export function builtProblems(root, dist) {
  const pages = [...sitePages(root).values()];
  const expected = [
    { source: 'README.md (home)', href: hrefOf('', 'en') },
    { source: 'README.fr.md (home)', href: hrefOf('', 'fr') },
    ...pages.map((page) => ({ source: page.source, href: hrefOf(page.route, page.locale) })),
  ];
  const missing = expected
    .filter(({ href }) => !fs.existsSync(htmlFileOf(dist, href)))
    .map(({ source, href }) => `${source}: no page at ${href} in the built site`);
  const shown = expected
    .filter(({ href }) => fs.existsSync(htmlFileOf(dist, href)))
    .flatMap(({ href }) => [...missingDiagrams(dist, href), ...dashes(dist, href)]);

  return [...missing, ...shown];
}

function htmlFileOf(dist, href) {
  return path.join(dist, href.slice(BASE.length), 'index.html');
}

function missingDiagrams(dist, href) {
  const html = fs.readFileSync(htmlFileOf(dist, href), 'utf8');
  const diagrams = [...html.matchAll(new RegExp(`src="${BASE}/diagrams/([^"]+)"`, 'g'))].map((match) => match[1]);

  return diagrams
    .filter((name) => !fs.existsSync(path.join(dist, 'diagrams', name)))
    .map((name) => `${href}: shows the diagram ${name}, which is not in the built site`);
}

function dashes(dist, href) {
  return DASH.test(fs.readFileSync(htmlFileOf(dist, href), 'utf8'))
    ? [`${href}: holds an em dash or an en dash, which no page of the repository does`]
    : [];
}
