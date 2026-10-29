import fs from 'node:fs';
import path from 'node:path';
import { Arguments } from '../../commands/arguments';
import { type Command } from '../../commands/command';
import { CONFIG_FILE, isOneOf, projectSeverity, readConfig, SEVERITIES } from '../../config';
import { DEFAULT_SEVERITIES } from '../catalogue/default-severities';
import { DELEGATED_RULES } from '../catalogue/delegated-rules';
import { RULES } from '../catalogue/rules';
import { SUPPRESSION_RULE } from '../catalogue/suppression-rule';
import { stdoutJson } from '../../json/stdout-json';

interface ListedRule {
  readonly id: string;
  readonly severity: string;
  readonly description: string;
  /** Which tool decides: this checker, ESLint for the rules that need a syntax tree, the formatter for the layout. */
  readonly checkedBy: string;
}

export const rulesCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {});
  const rules = listedRules(args.projectRoot);
  const width = Math.max(...rules.map((rule) => rule.id.length));
  const lines = rules.map((rule) => `${rule.id.padEnd(width)}  ${rule.severity.padEnd(5)}  ${rule.description}`);

  io.out(args.json ? stdoutJson(rules) : lines.join('\n'));

  return 0;
};

function listedRules(root: string): ListedRule[] {
  const configured = fs.existsSync(path.join(root, CONFIG_FILE))
    ? readConfig(root, { leaving: 'default' }).config.rules
    : {};

  const severityOf = (id: string): string => {
    const severity = projectSeverity(configured[id]);

    return isOneOf(SEVERITIES, severity) ? severity : (DEFAULT_SEVERITIES[id] ?? 'error');
  };

  const own = [...RULES, SUPPRESSION_RULE].map((rule) => ({
    id: rule.id,
    severity: severityOf(rule.id),
    description: rule.description,
    checkedBy: 'ddd-ts-kit check',
  }));

  const delegated = DELEGATED_RULES.map((rule) => ({
    id: rule.id,
    severity: severityOf(rule.id),
    description: `${rule.description} (${rule.authority})`,
    checkedBy: rule.checkedBy,
  }));

  return [...own, ...delegated];
}
