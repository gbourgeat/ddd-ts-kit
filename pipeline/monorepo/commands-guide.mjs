#!/usr/bin/env node
/**
 * Writes the reference part of docs/guides/commands.md, between its markers, from the help of
 * the built CLI, so the page cannot drift from the commands and flags the CLI accepts. A test
 * of the CLI (commands-guide.spec.ts) fails when the page differs.
 *
 *   npm run build && node pipeline/monorepo/commands-guide.mjs           rewrites the page
 *   npm run build && node pipeline/monorepo/commands-guide.mjs --check   exits 1 when it is stale
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');
const GUIDE = path.join(ROOT, 'docs/guides/commands.md');
const OPEN = '<!-- ddd-ts-kit:commands -->';
const CLOSE = '<!-- /ddd-ts-kit:commands -->';

// The built CLI, found at run time: a fresh checkout has no dist/ until `npm run build`.
const built = path.join(ROOT, 'packages/cli/dist/help/commands-guide-region.js');
const { commandsGuideRegion } = await import(pathToFileURL(built).href);

const page = fs.readFileSync(GUIDE, 'utf8');
const start = page.indexOf(OPEN);
const end = page.indexOf(CLOSE);

if (start === -1 || end < start) {
  console.error(`${path.relative(ROOT, GUIDE)} lacks the markers ${OPEN} and ${CLOSE}.`);
  process.exit(1);
}

const next = `${page.slice(0, start + OPEN.length)}\n${commandsGuideRegion().join('\n')}\n${page.slice(end)}`;

if (process.argv.includes('--check')) {
  if (next !== page) {
    console.error(
      'docs/guides/commands.md is stale: run `npm run build && node pipeline/monorepo/commands-guide.mjs`.',
    );
    process.exit(1);
  }
} else {
  fs.writeFileSync(GUIDE, next);
}
