import { CliError } from '../../cli-error.js';
import { ESLINT_AUTHORITY } from '../catalogue/eslint-authority.js';
import { KNOWN_RULE_IDS } from '../catalogue/known-rule-ids.js';
import { RULE_IDS } from '../catalogue/rule-ids.js';

/** The ids given, when this checker runs them all; an id it does not run is a mistake of the caller. */
export function knownRules(ids: readonly string[]): readonly string[] {
  const unknown = ids.find((id) => !RULE_IDS.includes(id));

  if (unknown === undefined) return ids;

  if (KNOWN_RULE_IDS.includes(unknown)) {
    throw new CliError(`The rule "${unknown}" is ${ESLINT_AUTHORITY}, not by this command.`, 'Run `npm run lint` for it; `ddd-ts-kit check` holds the rules listed by `ddd-ts-kit rules` without that mention.');
  }

  throw new CliError(`Unknown rule "${unknown}".`, `Use one of: ${RULE_IDS.join(', ')}.`);
}
