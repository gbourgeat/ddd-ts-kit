import type { Project, SourceFile, Violation } from './types.js';

export const SUPPRESSION_RULE_ID = 'config/suppression-needs-reason';
const DIRECTIVE = /^ddd-ts-kit-disable-next-line\b\s*(.*)$/;

export interface Suppression {
  readonly file: string;
  /** Line of the directive; it silences its rule on the next line. */
  readonly line: number;
  readonly ruleId: string;
  readonly reason: string;
}

export function findSuppressions(file: SourceFile): Suppression[] {
  const suppressions: Suppression[] = [];
  for (const comment of file.scan.comments) {
    const match = DIRECTIVE.exec(comment.text);
    if (match === null || !comment.ownLine) continue;
    const [head = '', ...reason] = (match[1] ?? '').split('--');
    suppressions.push({ file: file.path, line: comment.line, ruleId: head.trim(), reason: reason.join('--').trim() });
  }
  return suppressions;
}

export function suppressionViolations(project: Project, suppressions: readonly Suppression[]): Violation[] {
  const configured = project.severity(SUPPRESSION_RULE_ID);
  if (configured === 'off') return [];
  return suppressions
    .filter((suppression) => suppression.ruleId === '' || suppression.reason === '')
    .map((suppression) => ({
      ruleId: SUPPRESSION_RULE_ID,
      severity: configured,
      file: suppression.file,
      line: suppression.line,
      message:
        suppression.ruleId === ''
          ? 'A suppression names no rule.'
          : `The suppression of "${suppression.ruleId}" gives no reason.`,
      fix: 'Remove the comment and fix the violation; a deliberate exception is written `// ddd-ts-kit-disable-next-line <rule-id> -- ADR-NNNN: <why>` and recorded in docs/adr/.',
    }));
}

/**
 * A directive covers the line below it. On the first line of a file it also covers
 * line 1, which is where file-level violations (naming, missing spec) are reported.
 */
export function isSuppressed(violation: Violation, suppressions: readonly Suppression[]): boolean {
  return suppressions.some(
    (suppression) =>
      suppression.file === violation.file &&
      suppression.ruleId === violation.ruleId &&
      suppression.reason !== '' &&
      (violation.line === suppression.line + 1 || (suppression.line === 1 && violation.line === 1)),
  );
}
