import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, KnexPersonalDataErasure } from '@ddd-ts-kit/knex';
import { IdentityPersonalDataErasure } from '@/contexts/identity/application/ports/identity-personal-data-erasure.port';
import { PersonPersonalFields } from '@/contexts/identity/infrastructure/persistence/person.personal-fields';

/**
 * The erasure of identity, as its declarations say: the row of the person deleted, in the network
 * of the work alone, which the platform runs once per network. Running it again reaches nothing.
 */
@Repository(IdentityPersonalDataErasure)
export class KnexIdentityPersonalDataErasure extends KnexPersonalDataErasure implements IdentityPersonalDataErasure {
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
