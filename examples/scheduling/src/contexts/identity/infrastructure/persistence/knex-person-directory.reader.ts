import type { KnexContext } from '@ddd-ts-kit/knex';
import type { PersonCard, PersonDirectoryContract } from '../../published-language/person-directory.contract.js';
import { IDENTITY_SCHEMA } from './identity.schema.js';
import type { PersonRow } from './person-row.schema.js';

/**
 * Answers the directory from the table of the persons: one statement, whatever the number of
 * identifiers. Not declared on its class: the contract is the token of the platform, which binds
 * it to this reader over the database of the unit of work.
 */
export class KnexPersonDirectory implements PersonDirectoryContract {
  constructor(private readonly database: KnexContext) {}

  async byIds(personIds: readonly string[]): Promise<readonly PersonCard[]> {
    if (personIds.length === 0) {
      return [];
    }

    const rows = await this.database
      .executor()<PersonRow, Pick<PersonRow, 'id' | 'display_name'>[]>('persons')
      .withSchema(IDENTITY_SCHEMA)
      .select('id', 'display_name')
      .whereIn('id', [...personIds])
      .orderBy('id');

    return rows.map((row) => ({ personId: row.id, displayName: row.display_name }));
  }
}
