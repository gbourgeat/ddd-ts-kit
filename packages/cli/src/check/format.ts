import { createHash } from 'node:crypto';
import type { CheckResult } from './engine.js';
import type { Violation } from './types.js';

export type CheckFormat = 'text' | 'json' | 'github' | 'gitlab';

export function formatCheck(result: CheckResult, format: CheckFormat): string {
  if (format === 'gitlab') return JSON.stringify(result.violations.map(toCodeQualityIssue), null, 2);
  if (format === 'json') {
    return JSON.stringify(
      {
        ok: result.errorCount === 0,
        errors: result.errorCount,
        warnings: result.warningCount,
        suppressions: result.suppressionCount,
        suppressed: result.suppressedCount,
        files: result.fileCount,
        violations: result.violations,
      },
      null,
      2,
    );
  }
  const lines = result.violations.map(format === 'github' ? githubLine : textLine);
  return [...lines, summaryLine(result)].join(format === 'github' ? '\n' : '\n\n');
}

function summaryLine(result: CheckResult): string {
  return `${plural(result.errorCount, 'error')}, ${plural(result.warningCount, 'warning')}, ${plural(result.suppressionCount, 'suppression')} in ${plural(result.fileCount, 'file')}.`;
}

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

function textLine(violation: Violation): string {
  const label = violation.severity === 'error' ? 'error' : 'warn ';
  return `${violation.file}:${violation.line}  ${label}  ${violation.ruleId}\n  ${violation.message}\n  fix: ${violation.fix}`;
}

function githubLine(violation: Violation): string {
  const level = violation.severity === 'error' ? 'error' : 'warning';
  const message = `${violation.message} Fix: ${violation.fix}`;
  return `::${level} file=${escapeProperty(violation.file)},line=${violation.line},title=${escapeProperty(violation.ruleId)}::${escapeData(message)}`;
}

/** GitHub cuts an annotation at the first raw newline or unescaped separator. */
const escapeData = (value: string): string => value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
const escapeProperty = (value: string): string => escapeData(value).replaceAll(':', '%3A').replaceAll(',', '%2C');

const CODE_QUALITY_SEVERITIES = { error: 'major', warn: 'minor' } as const;

/**
 * One issue of a GitLab Code Quality report. The fingerprint is stable across runs and does not
 * depend on the line, so a violation that merely moves is not reported as fixed and new.
 */
function toCodeQualityIssue(violation: Violation, index: number, all: readonly Violation[]): Record<string, unknown> {
  const rank = all.slice(0, index).filter((earlier) => identity(earlier) === identity(violation)).length;
  return {
    description: `${violation.message} Fix: ${violation.fix}`,
    check_name: violation.ruleId,
    fingerprint: createHash('sha256').update(`${identity(violation)}\n${rank}`).digest('hex'),
    severity: CODE_QUALITY_SEVERITIES[violation.severity],
    location: { path: violation.file, lines: { begin: violation.line } },
  };
}

function identity(violation: Violation): string {
  return [violation.ruleId, violation.file, violation.message].join('\n');
}
