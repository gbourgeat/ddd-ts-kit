import { createHash } from 'node:crypto';
import type { RuleExplanation } from '../model/rule-explanation.js';
import type { Violation } from '../model/violation.js';
import type { CheckResult } from './check-result.js';

export type CheckFormat = 'text' | 'json' | 'github' | 'gitlab';

/** The reason of each explained rule, by rule id: empty when the check was not asked to explain. */
type Reasons = ReadonlyMap<string, string>;

const CODE_QUALITY_SEVERITIES = { error: 'major', warn: 'minor' } as const;

/**
 * With explanations, text and json add them once per rule after the violations; an annotation of
 * github or gitlab is read alone, on its line of the diff, so it carries the reason of its rule.
 */
export function formatCheck(
  result: CheckResult,
  format: CheckFormat,
  explanations?: readonly RuleExplanation[],
): string {
  const reasons: Reasons = new Map(explanations?.map((explanation) => [explanation.id, explanation.why]));

  if (format === 'gitlab') {
    return JSON.stringify(codeQualityReport(result.violations, reasons), null, 2);
  }

  if (format === 'json') {
    return JSON.stringify(jsonOf(result, explanations), null, 2);
  }

  if (format === 'github') {
    return [...result.violations.map((violation) => githubLine(violation, reasons)), summaryLine(result)].join('\n');
  }

  const blocks = [...result.violations.map(textLine), ...(explanations ?? []).map(explanationBlock)];

  return [...blocks, summaryLine(result)].join('\n\n');
}

function jsonOf(result: CheckResult, explanations: readonly RuleExplanation[] | undefined): Record<string, unknown> {
  return {
    ok: result.errorCount === 0,
    errors: result.errorCount,
    warnings: result.warningCount,
    suppressions: result.suppressionCount,
    suppressed: result.suppressedCount,
    files: result.fileCount,
    violations: result.violations,
    ...(explanations === undefined ? {} : { explanations }),
  };
}

function summaryLine(result: CheckResult): string {
  return `${plural(result.errorCount, 'error')}, ${plural(result.warningCount, 'warning')}, ${plural(result.suppressionCount, 'suppression')} in ${plural(result.fileCount, 'file')}.`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function textLine(violation: Violation): string {
  const label = violation.severity === 'error' ? 'error' : 'warn ';

  return `${violation.file}:${violation.line}  ${label}  ${violation.ruleId}\n  ${violation.message}\n  fix: ${violation.fix}`;
}

function explanationBlock({ id, description, why }: RuleExplanation): string {
  return `${id}\n  ${description}\n  why: ${why}`;
}

function githubLine(violation: Violation, reasons: Reasons): string {
  const level = violation.severity === 'error' ? 'error' : 'warning';
  const message = annotationOf(violation, reasons);

  return `::${level} file=${escapeProperty(violation.file)},line=${violation.line},title=${escapeProperty(violation.ruleId)}::${escapeData(message)}`;
}

function annotationOf(violation: Violation, reasons: Reasons): string {
  const reason = reasons.get(violation.ruleId);

  return `${violation.message} Fix: ${violation.fix}${reason === undefined ? '' : ` Why: ${reason}`}`;
}

/** GitHub cuts an annotation at the first raw newline or unescaped separator. */
function escapeData(value: string): string {
  return value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

function escapeProperty(value: string): string {
  return escapeData(value).replaceAll(':', '%3A').replaceAll(',', '%2C');
}

/** The rank of a violation tells apart the identical ones of a file, whose fingerprints would otherwise collide. */
function codeQualityReport(violations: readonly Violation[], reasons: Reasons): Record<string, unknown>[] {
  return violations.map((violation, index) => {
    const rank = violations.slice(0, index).filter((earlier) => identity(earlier) === identity(violation)).length;

    return toCodeQualityIssue(violation, rank, reasons);
  });
}

/**
 * One issue of a GitLab Code Quality report. The fingerprint is stable across runs and does not
 * depend on the line, so a violation that merely moves is not reported as fixed and new.
 */
function toCodeQualityIssue(violation: Violation, rank: number, reasons: Reasons): Record<string, unknown> {
  return {
    description: annotationOf(violation, reasons),
    check_name: violation.ruleId,
    fingerprint: createHash('sha256')
      .update(`${identity(violation)}\n${rank}`)
      .digest('hex'),
    severity: CODE_QUALITY_SEVERITIES[violation.severity],
    location: { path: violation.file, lines: { begin: violation.line } },
  };
}

function identity(violation: Violation): string {
  return [violation.ruleId, violation.file, violation.message].join('\n');
}
