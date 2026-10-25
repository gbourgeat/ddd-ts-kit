#!/usr/bin/env node
// Every line a pull request adds to a registry of asymmetries, shown where the maintainer reads
// before merging: an annotation of the pull request and the summary of the run. A line there turns
// a failing parity or support check green, so it is a decision to read, never a formality.
//
//   node pipeline/monorepo/asymmetries.mjs --base <ref>

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/** A line that carries a decision: a reason (a text of some length), a refusal or a trait. */
const DECISION = /'[^']{20,}'|`[^`]{20,}`|\b(refusal|trait):/;

export const REGISTRIES = ['pipeline/monorepo/families.mjs', 'packages/cli/test/support/support-matrix.ts'];

/** The decisions a unified diff without context adds, each with its file and its line in the new version. */
export function addedLines(diff) {
  const added = [];
  let file;
  let line = 0;

  for (const text of diff.split('\n')) {
    const header = /^\+\+\+ b\/(.+)$/.exec(text);
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);

    if (header !== null) {
      file = header[1];
    } else if (hunk !== null) {
      line = Number(hunk[1]);
    } else if (text.startsWith('+') && file !== undefined) {
      const content = text.slice(1).trim();

      if (DECISION.test(content) && !content.startsWith('//')) {
        added.push({ file, line, content });
      }

      line += 1;
    }
  }

  return added;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const base = process.argv[process.argv.indexOf('--base') + 1] ?? 'origin/main';
  const diff = execFileSync('git', ['diff', '--unified=0', base, '--', ...REGISTRIES], { encoding: 'utf8' });
  const added = addedLines(diff);

  for (const { file, line, content } of added) {
    console.log(`::warning file=${file},line=${line},title=An asymmetry accepted::${content.replaceAll('%', '%25')}`);
  }

  const summary = process.env.GITHUB_STEP_SUMMARY;

  if (summary !== undefined && added.length > 0) {
    const rows = added.map(({ file, line, content }) => `| \`${file}:${line}\` | ${content.replaceAll('|', '\\|')} |`);

    fs.appendFileSync(
      summary,
      `## Asymmetries this pull request accepts\n\nEach line lets a gap through the parity or support checks: fill the gap, or merge only a reason that holds.\n\n| Where | Line |\n|---|---|\n${rows.join('\n')}\n`,
    );
  }

  console.log(`${added.length} line(s) added to the registries of asymmetries.`);
}
