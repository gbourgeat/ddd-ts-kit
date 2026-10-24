import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, KnexPersonalDataExport } from '@ddd-ts-kit/knex';
import { IdentityPersonalDataExport } from '@/contexts/identity/application/ports/identity-personal-data-export.port';
import { PersonPersonalFields } from '@/contexts/identity/infrastructure/persistence/person.personal-fields';

/** The export of identity, as its declarations say: the name and the address of the person, in the network of the work alone. */
@Repository(IdentityPersonalDataExport)
export class KnexIdentityPersonalDataExport extends KnexPersonalDataExport implements IdentityPersonalDataExport {
  constructor(database: KnexContext, scope: ExecutionScope) {
    super(database, {
      name: 'identity',
      declarations: [
        // ddd-ts-kit:personal-fields
        PersonPersonalFields,
        // /ddd-ts-kit:personal-fields
      ],
      tenant: scope,
    });
  }
}
