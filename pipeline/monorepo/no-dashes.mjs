#!/usr/bin/env node
/**
 * English typography of this repository: no em dash and no en dash, in any tracked kind of
 * file. Shared by both CI platforms and the pre-commit hook, so the three cannot drift.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.git', 'coverage', 'reports']);
const DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

process.exit(main());

function main() {
  const findings = filesUnder(ROOT).flatMap(dashesIn);
  for (const finding of findings) console.log(finding);
  console.log(findings.length === 0 ? 'No em dash or en dash.' : `\n${findings.length} line(s) hold an em dash or an en dash: write a colon, a comma, parentheses or a hyphen.`);
  return findings.length === 0 ? 0 : 1;
}

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRECTORIES.has(entry.name) ? [] : filesUnder(file);
    return entry.isFile() ? [file] : [];
  });
}

function dashesIn(file) {
  const content = fs.readFileSync(file);
  if (content.includes(0)) return [];
  return content
    .toString('utf8')
    .split('\n')
    .flatMap((line, index) => (DASH.test(line) ? [`${path.relative(ROOT, file)}:${index + 1}: ${line.trim().slice(0, 120)}`] : []));
}
