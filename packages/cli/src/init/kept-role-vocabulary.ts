import { heldEntries } from '../generate/vocabulary/held-entries';
import { vocabularyText } from '../generate/vocabulary/vocabulary-text';

/** The role vocabulary of the template with every role the file before holds: what a guard or a grant named stays named. */
export function keptRoleVocabulary(written: string, existing: string): string {
  return vocabularyText('Role', heldEntries(existing), written);
}
