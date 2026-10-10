import { CliError } from '../../cli-error.js';
import { Arguments } from '../../commands/arguments.js';
import { type Command } from '../../commands/command.js';
import { DELEGATED_RULES } from '../catalogue/delegated-rules.js';
import { KNOWN_RULE_IDS } from '../catalogue/known-rule-ids.js';
import { RULES } from '../catalogue/rules.js';
import { SUPPRESSION_RULE } from '../catalogue/suppression-rule.js';
import { RULE_DOCS } from '../explain/rule-docs.js';
import type { RuleDoc } from '../model/rule-doc.js';
import { knownRules } from './known-rules.js';

interface Explanation extends RuleDoc {
  readonly id: string;
  readonly description: string;
}

export const explainCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {});
  const [id] = args.positionals;

  if (id === undefined) {
    throw new CliError('explain needs a rule id.', `Use one of: ${KNOWN_RULE_IDS.join(', ')}.`);
  }

  const delegated = DELEGATED_RULES.find((rule) => rule.id === id);

  if (delegated !== undefined) {
    io.out(
      args.json
        ? JSON.stringify({ id, description: delegated.description, checkedBy: delegated.checkedBy }, null, 2)
        : [id, '', delegated.description, '', delegated.where].join('\n'),
    );

    return 0;
  }

  const explanation = explanationOf(id);

  io.out(args.json ? JSON.stringify(explanation, null, 2) : formatExplanation(explanation));

  return 0;
};

function explanationOf(id: string): Explanation {
  knownRules([id]);

  const rule = [...RULES, SUPPRESSION_RULE].find((candidate) => candidate.id === id);
  const doc = RULE_DOCS[id];

  if (rule === undefined || doc === undefined) {
    throw new CliError(`The rule "${id}" has no explanation.`, 'Report this as a bug of ddd-ts-kit.');
  }

  return { id, description: rule.description, ...doc };
}

function formatExplanation(explanation: Explanation): string {
  const indent = (block: string): string =>
    block
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n');

  const suppress = `Suppress one line (with a reason): // ddd-ts-kit-disable-next-line ${explanation.id} -- <reason>`;
  const { id, description, why, bad, good } = explanation;

  return [
    id,
    '',
    description,
    '',
    `Why: ${why}`,
    '',
    'Bad:',
    indent(bad),
    '',
    'Good:',
    indent(good),
    '',
    suppress,
  ].join('\n');
}
