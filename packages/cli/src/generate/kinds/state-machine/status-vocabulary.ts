import { CliError } from '../../../cli-error.js';
import type { Name } from '../../../naming/index.js';
import type { Scope } from '../../scope.js';
import { entriesOf } from '../../vocabulary/entries-of.js';
import { heldEntries } from '../../vocabulary/held-entries.js';
import type { VocabularyEntry } from '../../vocabulary/vocabulary-entry.js';
import { vocabularyText } from '../../vocabulary/vocabulary-text.js';

/**
 * The closed vocabulary of the status of an aggregate, `<Aggregate>Status`: created from the
 * values of `--value`, or extended with the ones it does not hold. Answers every entry, in order.
 */
export function statusVocabulary(scope: Scope, aggregate: Name): VocabularyEntry[] {
  const name = `${aggregate.pascal}Status`;
  const file = `${scope.dir}/domain/vocabularies/${aggregate.kebab}-status.vocabulary.ts`;
  const existing = scope.ws.read(file);
  const asked = scope.flags.value.length === 0 ? [] : entriesOf(scope.flags.value);

  if (existing === undefined && asked.length < 2) {
    throw new CliError(
      `${name} does not exist, and a lifecycle needs two states at least.`,
      `Pass each state with --value, the initial one first: \`ddd-ts-kit generate state-machine ${scope.context.kebab} ${aggregate.pascal} --value draft --value issued --transition "issue:draft>issued"\`.`,
    );
  }

  const text = vocabularyText(name, asked, existing);

  if (existing === undefined) {
    scope.ws.create(file, text);
  } else if (text !== existing) {
    scope.ws.update(file, text);
  }

  return heldEntries(text);
}
