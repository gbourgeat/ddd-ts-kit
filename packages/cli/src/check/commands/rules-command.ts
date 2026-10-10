import fs from 'node:fs';
import path from 'node:path';
import { Arguments } from '../../commands/arguments.js';
import { type Command } from '../../commands/command.js';
import { CONFIG_FILE, isOneOf, readConfig, SEVERITIES } from '../../config/index.js';
import { DEFAULT_SEVERITIES } from '../catalogue/default-severities.js';
import { ESLINT_AUTHORITY } from '../catalogue/eslint-authority.js';
import { ESLINT_ONLY_RULES } from '../catalogue/eslint-only-rules.js';
import { RULES } from '../catalogue/rules.js';
import { SUPPRESSION_RULE } from '../catalogue/suppression-rule.js';

interface ListedRule {
  readonly id: string;
  readonly severity: string;
  readonly description: string;
  /** Which analyzer decides: this checker, or ESLint for the rules that need a syntax tree. */
  readonly checkedBy: string;
}

export const rulesCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {});
  const rules = listedRules(args.projectRoot);
  const width = Math.max(...rules.map((rule) => rule.id.length));
  const lines = rules.map((rule) => `${rule.id.padEnd(width)}  ${rule.severity.padEnd(5)}  ${rule.description}`);

  io.out(args.json ? JSON.stringify(rules, null, 2) : lines.join('\n'));

  return 0;
};

function listedRules(root: string): ListedRule[] {
  const configured = fs.existsSync(path.join(root, CONFIG_FILE)) ? readConfig(root).config.rules : {};

  const severityOf = (id: string): string => {
    const severity = configured[id];

    return isOneOf(SEVERITIES, severity) ? severity : (DEFAULT_SEVERITIES[id] ?? 'error');
  };

  const own = [...RULES, SUPPRESSION_RULE].map((rule) => ({ id: rule.id, severity: severityOf(rule.id), description: rule.description, checkedBy: 'ddd-ts-kit check' }));
  const delegated = ESLINT_ONLY_RULES.map((rule) => ({ id: rule.id, severity: severityOf(rule.id), description: `${rule.description} (${ESLINT_AUTHORITY})`, checkedBy: '@ddd-ts-kit/eslint-plugin' }));

  return [...own, ...delegated];
}
