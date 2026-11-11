import { CliError } from '../../../cli-error';
import type { Scope } from '../../scope';
import { personalRequestOf, type PersonalRequest } from './personal-request-of';

/**
 * The request of `generate personal-fields`, on a table no aggregate owns: `--personal` and
 * `--subject` are both required, then checked as `--personal` of a repository is. No default
 * names the subject there: the row of such a table (a read model, a received message) is rarely
 * the person, and a declaration that said `id` would have the erasure look for the person in the
 * wrong column while the register says the table is covered.
 */
export function personalRequestOfTable(scope: Scope): PersonalRequest {
  const { personal, subject } = scope.flags;
  const request = personal === undefined || subject === undefined ? undefined : personalRequestOf(scope);

  if (request !== undefined) {
    return request;
  }

  throw personal === undefined
    ? new CliError(
        'generate personal-fields needs --personal: the columns of the table that hold personal data.',
        'Name them as the database spells them, comma separated: --personal email,display_name --subject <column>.',
      )
    : new CliError(
        'generate personal-fields needs --subject: the column that holds the id of the person a row is about.',
        'Name it: --subject customer_id. No default here: on a table without aggregate the row is rarely the person, and a declaration that named `id` by default would have `npm run privacy:erase -- <person>` miss the row while the register says the column is covered. Give `--subject id` only when the id of the row is the id of the person.',
      );
}
