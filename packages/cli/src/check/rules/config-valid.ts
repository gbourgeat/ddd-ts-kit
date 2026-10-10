import { KNOWN_RULE_IDS } from '../catalogue/known-rule-ids.js';
import { ConfigInspection } from '../configuration/config-inspection.js';
import type { Rule } from '../model/rule.js';
import { reporter } from '../support/reporter.js';

export const configValid: Rule = {
  id: 'config/valid',
  description: 'ddd-ts-kit.config.json is consistent: known contexts, classifications, relationships, rule ids and guard mode, the same contexts as on disk, a function limit within the ceiling, complete onePerFile.allow entries and positive commit limits.',
  scope: 'project',
  run(project) {
    const inspection = new ConfigInspection(project, reporter(project, this.id));

    return [
      ...Object.entries(project.config.contexts).flatMap(([name, context]) => inspection.declaredContext(name, context)),
      ...inspection.undeclaredDirectories(),
      ...inspection.ruleSettings(KNOWN_RULE_IDS),
      ...inspection.guardMode(),
      ...inspection.functionLinesLimit(),
      ...inspection.onePerFileAllowances(),
      ...inspection.commitLimits(),
    ];
  },
};
