#!/usr/bin/env node
/**
 * Writes the reference part of docs/guides/commands.md, between its markers, from the help of
 * the built CLI, so the page cannot drift from the commands and flags the CLI accepts. The
 * French page docs/guides/commands.fr.md, once written, holds the same reference between the
 * same markers: it is the help of the CLI, in English on both pages. A test of the CLI
 * (commands-guide.spec.ts) fails when a page differs.
 *
 *   npm run build && node pipeline/monorepo/commands-guide.mjs           rewrites the pages
 *   npm run build && node pipeline/monorepo/commands-guide.mjs --check   exits 1 when one is stale
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');
const GUIDES = ['docs/guides/commands.md', 'docs/guides/commands.fr.md'];
const OPEN = '<!-- ddd-ts-kit:commands -->';
const CLOSE = '<!-- /ddd-ts-kit:commands -->';

// The built CLI, found at run time: a fresh checkout has no dist/ until `npm run build`.
const built = path.join(ROOT, 'packages/cli/dist/help/commands-guide-region.js');
const { commandsGuideRegion } = await import(pathToFileURL(built).href);
const checking = process.argv.includes('--check');
const guides = GUIDES.filter((guide, index) => index === 0 || fs.existsSync(path.join(ROOT, guide)));
const failures = guides.flatMap((guide) => refresh(guide));

for (const failure of failures) {
  console.error(failure);
}

process.exit(failures.length === 0 ? 0 : 1);

function refresh(guide) {
  const page = fs.readFileSync(path.join(ROOT, guide), 'utf8');
  const start = page.indexOf(OPEN);
  const end = page.indexOf(CLOSE);

  if (start === -1 || end < start) {
    return [`${guide} lacks the markers ${OPEN} and ${CLOSE}.`];
  }

  const next = `${page.slice(0, start + OPEN.length)}\n${commandsGuideRegion().join('\n')}\n${page.slice(end)}`;

  if (checking) {
    return next === page
      ? []
      : [`${guide} is stale: run \`npm run build && node pipeline/monorepo/commands-guide.mjs\`.`];
  }

  fs.writeFileSync(path.join(ROOT, guide), next);
  return [];
}
