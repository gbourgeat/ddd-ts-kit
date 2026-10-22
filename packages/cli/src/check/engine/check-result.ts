import type { Violation } from '../model/violation';

export interface CheckResult {
  readonly violations: Violation[];
  readonly errorCount: number;
  readonly warningCount: number;
  /** Violations silenced by a directive that gives a reason. */
  readonly suppressedCount: number;
  readonly suppressionCount: number;
  readonly fileCount: number;
}
