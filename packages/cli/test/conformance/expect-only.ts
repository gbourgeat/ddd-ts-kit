import { expect } from 'vitest';
import type { Finding } from './finding.js';
import type { Injection } from './injection.js';

type Tool = 'checker' | 'eslint';

/**
 * Holds one analyzer to an injection: it reports the rule on the file when it owns the rule, and
 * nothing else than the companions the injection declares, each of which it has to report as well.
 */
export function expectOnly(tool: Tool, findings: readonly Finding[], injection: Injection): void {
  const owned = tool === 'checker' ? (injection.checker ? injection.rule : undefined) : injection.eslint;
  const companions = (injection.alsoReports ?? []).filter((companion) => companion.tool === tool);
  const reported = [...new Set(findings.map((finding) => `${finding.rule} on ${finding.file}`))].sort();
  const expected = owned === undefined ? [] : [`${owned} on ${injection.file}`];
  const allowed = new Set(companions.map((companion) => companion.rule));
  const unexpected = reported.filter((entry) => !expected.includes(entry) && !allowed.has(ruleOf(entry)));
  const missing = [...allowed].filter((rule) => !reported.some((entry) => ruleOf(entry) === rule));
  const said = findings.map((finding) => `${finding.rule} on ${finding.file}: ${finding.message}`).join('\n');

  expect(reported, `${tool}, ${injection.rule}:\n${said}`).toEqual(expect.arrayContaining(expected));
  expect(unexpected, `${tool}, ${injection.rule}: undeclared findings\n${said}`).toEqual([]);
  expect(missing, `${tool}, ${injection.rule}: a declared companion is no longer reported`).toEqual([]);
}

function ruleOf(entry: string): string {
  return entry.slice(0, entry.indexOf(' on '));
}
