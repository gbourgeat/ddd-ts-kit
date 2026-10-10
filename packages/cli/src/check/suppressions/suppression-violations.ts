import type { Project } from '../model/project.js';
import type { Violation } from '../model/violation.js';
import type { Suppression } from './find-suppressions.js';
import { SUPPRESSION_RULE_ID } from './suppression-rule-id.js';

const FIX = 'Remove the comment and fix the violation; a deliberate exception is written `// ddd-ts-kit-disable-next-line <rule-id> -- ADR-NNNN: <why>` and recorded in docs/adr/.';

/** The directives that name no rule or give no reason. */
export function suppressionViolations(project: Project, suppressions: readonly Suppression[]): Violation[] {
  const severity = project.severity(SUPPRESSION_RULE_ID);

  if (severity === 'off') return [];

  return suppressions
    .filter((suppression) => suppression.ruleId === '' || suppression.reason === '')
    .map((suppression) => {
      const message = suppression.ruleId === '' ? 'A suppression names no rule.' : `The suppression of "${suppression.ruleId}" gives no reason.`;

      return { ruleId: SUPPRESSION_RULE_ID, severity, file: suppression.file, line: suppression.line, message, fix: FIX };
    });
}
