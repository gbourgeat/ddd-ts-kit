import { CliError } from '../../cli-error';
import { Arguments } from '../../commands/arguments';
import { type Command } from '../../commands/command';
import { DELEGATED_RULES } from '../catalogue/delegated-rules';
import { KNOWN_RULE_IDS } from '../catalogue/known-rule-ids';
import { delegatedDoc } from '../explain/delegated-doc';
import { type DocumentedRule, documentedRule } from '../explain/documented-rule';
import { knownRules } from './known-rules';
import { stdoutJson } from '../../json/stdout-json';

export const explainCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {});
  const [id] = args.positionals;

  if (id === undefined) {
    throw new CliError('explain needs a rule id.', `Use one of: ${KNOWN_RULE_IDS.join(', ')}.`);
  }

  const delegated = DELEGATED_RULES.find((rule) => rule.id === id);

  if (delegated !== undefined) {
    const explanation = { ...delegatedDoc(id), id, description: delegated.description, checkedBy: delegated.checkedBy };

    io.out(args.json ? stdoutJson(explanation) : formatExplanation(explanation, delegated.where));

    return 0;
  }

  const explanation = explanationOf(id);

  const suppress = `Suppress one line (with a reason): // ddd-ts-kit-disable-next-line ${id} -- <reason>`;

  io.out(args.json ? stdoutJson(explanation) : formatExplanation(explanation, suppress));

  return 0;
};

function explanationOf(id: string): DocumentedRule {
  knownRules([id]);

  return documentedRule(id);
}

/** The reason and the examples of a rule, then `closing`: how to suppress a line, or which tool decides. */
function formatExplanation(explanation: DocumentedRule, closing: string): string {
  const indent = (block: string): string =>
    block
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n');

  const { id, description, why, bad, good } = explanation;

  return [id, '', description, '', `Why: ${why}`, '', 'Bad:', indent(bad), '', 'Good:', indent(good), '', closing].join(
    '\n',
  );
}
