import { ignoreHints } from '../coverage/ignore-hints.js';
import { runnerSettings } from '../coverage/runner-settings.js';
import { scriptFlags } from '../coverage/script-flags.js';
import { DecisionRecords } from '../governance/decision-records.js';
import type { Rule } from '../model/rule.js';
import { perFile } from '../support/per-file.js';
import { reporter } from '../support/reporter.js';

export const testCoverageGoverned: Rule = {
  id: 'test/coverage-governed',
  description:
    'Coverage cannot be gamed by exclusion: the test runner config reads the measured layers and their thresholds from ddd-ts-kit.config.json and writes no include, exclude or thresholds by hand, no script sets them by a flag, and no production source carries a coverage ignore comment without a decision record.',
  scope: 'file',
  run(project) {
    const records = new DecisionRecords(project.root);

    return perFile(project, this.id, (file) => ignoreHints(file, records));
  },
  acrossProject(project) {
    const report = reporter(project, this.id);

    return [...runnerSettings(project), ...scriptFlags(project)].map(({ file, line, message, fix }) =>
      report({ file, line }, message, fix),
    );
  },
};
