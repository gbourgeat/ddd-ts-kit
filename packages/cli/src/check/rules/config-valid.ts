import { KNOWN_RULE_IDS } from '../catalogue/known-rule-ids.js';
import { ConfigInspection } from '../configuration/config-inspection.js';
import type { Rule } from '../model/rule.js';
import { reporter } from '../support/reporter.js';

export const configValid: Rule = {
  id: 'config/valid',
  description:
    'ddd-ts-kit.config.json is consistent: known contexts, classifications, relationships, rule ids, guard mode and import extension, the same contexts as on disk, a function limit within the ceiling, complete onePerFile.allow entries, positive commit limits and coverage thresholds that are percentages.',
  scope: 'project',
  run(project) {
    const inspection = new ConfigInspection(project, reporter(project, this.id));

    return [
      ...Object.entries(project.config.contexts).flatMap(([name, context]) =>
        inspection.declaredContext(name, context),
      ),
      ...inspection.undeclaredDirectories(),
      ...inspection.ruleSettings(KNOWN_RULE_IDS),
      ...inspection.guardMode(),
      ...inspection.importExtension(),
      ...inspection.functionLinesLimit(),
      ...inspection.onePerFileAllowances(),
      ...inspection.commitLimits(),
      ...inspection.coverageThresholds(),
    ];
  },
};
