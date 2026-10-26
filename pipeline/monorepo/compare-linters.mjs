#!/usr/bin/env node
// What ESLint and Oxlint say of the same tree, compared by file, line and rule. The trial job of the
// pipeline runs both with their JSON output and writes the difference to its summary; the difference
// fails nothing.
//
//   node pipeline/monorepo/compare-linters.mjs <eslint.json> <oxlint.json> [root]
//
// Writes a markdown report on stdout. Exit code 0 whatever the difference.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}

/** Rules of ESLint that Oxlint does not implement: their findings are expected on the ESLint side alone. */
export const NOT_IMPLEMENTED_BY_OXLINT = new Set(['no-unsafe-enum-assignment']);

/** `@typescript-eslint/x` of ESLint is `x` in both; the plugins of Oxlint print `scope(rule)` where ESLint prints `scope/rule`. */
export function ruleOfEslint(ruleId) {
  if (ruleId === null || ruleId === undefined) {
    return 'fatal';
  }

  return ruleId.replace(/^@typescript-eslint\//, '');
}

export function ruleOfOxlint(code) {
  const match = /^(.+?)\((.+)\)$/.exec(code ?? '');

  if (match === null) {
    return code ?? 'fatal';
  }

  const [, scope, rule] = match;

  if (scope === 'eslint' || scope === 'typescript') {
    return rule;
  }

  return `${scope.replace(/^@(ddd-ts-kit)$/, '$1')}/${rule}`;
}

/** Findings of `eslint --format json`, as `file:line rule`. */
export function eslintFindings(report, root) {
  return report.flatMap(({ filePath, messages }) =>
    messages.map(({ ruleId, line }) => key(path.relative(root, filePath), line ?? 0, ruleOfEslint(ruleId))),
  );
}

/** Findings of `oxlint --format json`, as `file:line rule`. */
export function oxlintFindings(report, root) {
  return report.diagnostics.map(({ code, filename, labels }) =>
    key(path.relative(root, filename.replace(/^file:\/\//, '')), labels?.[0]?.span?.line ?? 0, ruleOfOxlint(code)),
  );
}

function key(file, line, rule) {
  return `${file.split(path.sep).join('/')}:${line} ${rule}`;
}

/** The findings of each side the other lacks; a finding twice on one side and once on the other is one more. */
export function difference(eslint, oxlint) {
  const left = count(eslint);
  const right = count(oxlint);
  const only = (from, other) =>
    [...from].flatMap(([finding, times]) => Array(Math.max(0, times - (other.get(finding) ?? 0))).fill(finding)).sort();

  return {
    eslint: eslint.length,
    oxlint: oxlint.length,
    same: eslint.length - only(left, right).length,
    eslintOnly: only(left, right),
    oxlintOnly: only(right, left),
  };
}

function count(findings) {
  const counts = new Map();

  for (const finding of findings) {
    counts.set(finding, (counts.get(finding) ?? 0) + 1);
  }

  return counts;
}

/** The report: totals, then each finding only one side makes, the ones Oxlint cannot make marked as expected. */
export function report(result) {
  const expected = result.eslintOnly.filter((finding) => NOT_IMPLEMENTED_BY_OXLINT.has(ruleOf(finding)));
  const unexpected = result.eslintOnly.filter((finding) => !expected.includes(finding));
  const lines = [
    '## ESLint and Oxlint, finding by finding (file, line, rule)',
    '',
    '| ESLint | Oxlint | at the same place | ESLint only | Oxlint only | expected (not implemented by Oxlint) |',
    '|---|---|---|---|---|---|',
    `| ${result.eslint} | ${result.oxlint} | ${result.same} | ${unexpected.length} | ${result.oxlintOnly.length} | ${expected.length} |`,
    '',
  ];

  for (const [title, findings] of [
    ['ESLint only', unexpected],
    ['Oxlint only', result.oxlintOnly],
    ['Expected, ESLint only', expected],
  ]) {
    if (findings.length > 0) {
      lines.push(`### ${title}`, '', '```', ...findings, '```', '');
    }
  }

  return lines.join('\n');
}

function main([eslintFile, oxlintFile, root = process.cwd()]) {
  const eslint = JSON.parse(fs.readFileSync(eslintFile, 'utf8'));
  const text = fs.readFileSync(oxlintFile, 'utf8');
  const oxlint = JSON.parse(text.slice(text.indexOf('{')));

  process.stdout.write(`${report(difference(eslintFindings(eslint, root), oxlintFindings(oxlint, root)))}\n`);

  return 0;
}

function ruleOf(finding) {
  return finding.slice(finding.indexOf(' ') + 1);
}
