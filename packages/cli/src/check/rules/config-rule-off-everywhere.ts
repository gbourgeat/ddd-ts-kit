import { CONFIG_FILE } from '../../config/index.js';
import type { Rule } from '../model/rule.js';
import { lineOfSequence } from '../support/line-of-sequence.js';
import { reporter } from '../support/reporter.js';
import { toViolations } from '../support/to-violations.js';

export const configRuleOffEverywhere: Rule = {
  id: 'config/rule-off-everywhere',
  description:
    'A rule turned off is turned off for the files it is meant for: "off" alone silences it in every file of the project, the ones nobody thought of included.',
  scope: 'project',
  run(project) {
    const { config, configText } = project;

    const findings = Object.entries(config.rules)
      .filter(([, setting]) => setting === 'off')
      .map(([id]) => ({
        line: lineOfSequence(configText, ['"rules"', `"${id}":`]),
        message: `The rule "${id}" is off for the whole project: no file is judged by it, not only the ones its exception is about.`,
        fix: `Turn it off for the files it is meant for, \`"${id}": { "severity": "off", "files": ["<glob>"] }\`; when the whole project is meant, say so with \`"files": ["**"]\`.`,
      }));

    return toViolations(reporter(project, this.id), CONFIG_FILE, findings);
  },
};
