import { RULES } from './rules/index.js';
import { findSuppressions, isSuppressed, SUPPRESSION_RULE_ID, suppressionViolations } from './suppressions.js';
import type { Project, Rule, Violation } from './types.js';

export interface CheckOptions {
  /** Run only these rule ids. */
  readonly rules?: readonly string[];
  /** Skip the rules that need the whole tree. */
  readonly fileScopeOnly?: boolean;
}

export interface CheckResult {
  readonly violations: Violation[];
  readonly errorCount: number;
  readonly warningCount: number;
  /** Violations silenced by a directive that gives a reason. */
  readonly suppressedCount: number;
  readonly suppressionCount: number;
  readonly fileCount: number;
}

export function runCheck(project: Project, options: CheckOptions = {}): CheckResult {
  const selected = (id: string): boolean => options.rules === undefined || options.rules.length === 0 || options.rules.includes(id);
  const suppressions = project.files.flatMap(findSuppressions);
  const raw = RULES.filter((rule) => selected(rule.id) && project.severity(rule.id) !== 'off').flatMap((rule) => violationsOf(rule, project, options.fileScopeOnly === true));
  const kept = raw.filter((violation) => !isSuppressed(violation, suppressions));
  const suppressedCount = raw.length - kept.length;
  if (selected(SUPPRESSION_RULE_ID)) kept.push(...suppressionViolations(project, suppressions));
  kept.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.ruleId.localeCompare(b.ruleId));
  return summarize(kept, { suppressedCount, suppressionCount: suppressions.length, fileCount: project.files.length });
}

function violationsOf(rule: Rule, project: Project, oneFileOnly: boolean): Violation[] {
  if (!oneFileOnly) return [...rule.run(project), ...(rule.acrossProject?.(project) ?? [])];
  return rule.scope === 'project' ? [] : rule.run(project);
}

/** Counts what is reported; the totals about suppressions and files come from the run it derives from. */
export function summarize(violations: Violation[], run?: Pick<CheckResult, 'suppressedCount' | 'suppressionCount' | 'fileCount'>): CheckResult {
  return {
    violations,
    errorCount: violations.filter((violation) => violation.severity === 'error').length,
    warningCount: violations.filter((violation) => violation.severity === 'warn').length,
    suppressedCount: run?.suppressedCount ?? 0,
    suppressionCount: run?.suppressionCount ?? 0,
    fileCount: run?.fileCount ?? 0,
  };
}
