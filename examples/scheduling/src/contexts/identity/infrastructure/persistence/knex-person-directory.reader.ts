import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import { tenantTable, type KnexContext } from '@ddd-ts-kit/knex';
import type {
  PersonCard,
  PersonDirectoryContract,
} from '@/contexts/identity/published-language/person-directory.contract';
import { IDENTITY_SCHEMA } from '@/contexts/identity/infrastructure/persistence/identity.schema';
import type { PersonRow } from '@/contexts/identity/infrastructure/persistence/person-row.schema';

/** The persons of the network of the work: another network's persons are not in its directory. */
const PERSONS = { schema: IDENTITY_SCHEMA, table: 'persons' };

/**
 * Answers the directory from the table of the persons: one statement, whatever the number of
 * identifiers. Not declared on its class: the contract is the token of the platform, which binds
 * it to this reader over the database of the unit of work.
 */
export class KnexPersonDirectory implements PersonDirectoryContract {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
  ) {}

  async byIds(personIds: readonly string[]): Promise<readonly PersonCard[]> {
    if (personIds.length === 0) {
      return [];
    }

    const rows = await tenantTable<PersonRow>(this.database, this.scope, PERSONS)
      .select('id', 'display_name')
      .whereIn('id', [...personIds])
      .orderBy('id');

    return rows.map((row) => ({ personId: row.id, displayName: row.display_name }));
  }
}
