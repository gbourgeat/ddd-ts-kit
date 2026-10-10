import { CliError } from '../../cli-error.js';
import { DELEGATED_RULES } from '../catalogue/delegated-rules.js';
import { RULE_IDS } from '../catalogue/rule-ids.js';

/** The ids given, when this checker runs them all; an id it does not run is a mistake of the caller. */
export function knownRules(ids: readonly string[]): readonly string[] {
  const unknown = ids.find((id) => !RULE_IDS.includes(id));

  if (unknown === undefined) {
    return ids;
  }

  const delegated = DELEGATED_RULES.find((rule) => rule.id === unknown);

  if (delegated !== undefined) {
    throw new CliError(
      `The rule "${unknown}" is ${delegated.authority}, not by this command.`,
      `Run \`${delegated.script}\` for it; \`ddd-ts-kit check\` holds the rules listed by \`ddd-ts-kit rules\` without that mention.`,
    );
  }

  throw new CliError(`Unknown rule "${unknown}".`, `Use one of: ${RULE_IDS.join(', ')}.`);
}
