import { RULES } from '../catalogue/rules.js';
import type { Project } from '../model/project.js';
import type { Rule } from '../model/rule.js';
import type { Violation } from '../model/violation.js';
import { findSuppressions } from '../suppressions/find-suppressions.js';
import { isSuppressed } from '../suppressions/is-suppressed.js';
import { SUPPRESSION_RULE_ID } from '../suppressions/suppression-rule-id.js';
import { suppressionViolations } from '../suppressions/suppression-violations.js';
import type { CheckResult } from './check-result.js';
import { summarize } from './summarize.js';

export interface CheckOptions {
  /** Run only these rule ids. */
  readonly rules?: readonly string[];
  /** Skip the rules that need the whole tree. */
  readonly fileScopeOnly?: boolean;
}

export function runCheck(project: Project, options: CheckOptions = {}): CheckResult {
  const selected = (id: string): boolean => options.rules === undefined || options.rules.length === 0 || options.rules.includes(id);
  const suppressions = project.files.flatMap(findSuppressions);
  const active = RULES.filter((rule) => selected(rule.id) && project.severity(rule.id) !== 'off');
  const raw = active.flatMap((rule) => violationsOf(rule, project, options.fileScopeOnly === true));
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
