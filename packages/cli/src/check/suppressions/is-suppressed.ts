import type { Violation } from '../model/violation.js';
import type { Suppression } from './find-suppressions.js';

/**
 * A directive covers the line below it. On the first line of a file it also covers
 * line 1, which is where file-level violations (naming, missing spec) are reported.
 */
export function isSuppressed(violation: Violation, suppressions: readonly Suppression[]): boolean {
  return suppressions.some((suppression) => {
    const sameRule = suppression.file === violation.file && suppression.ruleId === violation.ruleId && suppression.reason !== '';

    return sameRule && (violation.line === suppression.line + 1 || (suppression.line === 1 && violation.line === 1));
  });
}
