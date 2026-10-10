#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const USAGE = 'Usage: arch-to-codequality.mjs <check.json> <code-quality.json>';
const SEVERITIES = { error: 'major', warn: 'minor' };

main(process.argv.slice(2));

function main([input, output]) {
  if (input === undefined || output === undefined) {
    fail(USAGE);
  }
  const result = readCheckResult(input);
  const issues = result.violations.map(toIssue);
  writeFileSync(output, `${JSON.stringify(issues, null, 2)}\n`);
  console.log(summary(result, output));
  process.exitCode = result.ok ? 0 : 1;
}

function readCheckResult(file) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${file} is not the JSON printed by \`ddd-ts-kit check --format json\`: ${error.message}`);
  }
  if (typeof parsed?.ok !== 'boolean' || !Array.isArray(parsed.violations)) {
    fail(`${file} has no "ok" and "violations": run \`ddd-ts-kit check --format json\` to see why.`);
  }
  return parsed;
}

function toIssue(violation, index, all) {
  return {
    description: `${violation.message} Fix: ${violation.fix}`,
    check_name: violation.ruleId,
    fingerprint: fingerprint(violation, occurrence(violation, index, all)),
    severity: SEVERITIES[violation.severity] ?? 'info',
    location: { path: violation.file, lines: { begin: violation.line } },
  };
}

function occurrence(violation, index, all) {
  return all.slice(0, index).filter((earlier) => identity(earlier) === identity(violation)).length;
}

function fingerprint(violation, rank) {
  return createHash('sha256')
    .update(`${identity(violation)}\n${rank}`)
    .digest('hex');
}

function identity(violation) {
  return [violation.ruleId, violation.file, violation.message].join('\n');
}

function summary(result, output) {
  const errors = result.violations.filter((violation) => violation.severity === 'error');
  const lines = errors.map(
    (violation) => `${violation.file}:${violation.line}  ${violation.ruleId}  ${violation.message}`,
  );
  return [...lines, `${result.violations.length} violation(s), ${errors.length} error(s), written to ${output}.`].join(
    '\n',
  );
}

function fail(message) {
  console.error(message);
  process.exit(2);
}
