import { InMemoryRepository } from '@ddd-ts-kit/testing';
import { Organisation } from '{{alias.context}}/domain/aggregates/organisation.aggregate{{alias.ext}}';
import type { OrganisationRepository } from '{{alias.context}}/domain/repositories/organisation.repository{{alias.ext}}';

export class FakeOrganisationRepository extends InMemoryRepository<Organisation> implements OrganisationRepository {
  constructor() {
    // A copy by rehydration and not a snapshot: a snapshot goes through `structuredClone`, which turns the value objects of the state into plain objects. The state is immutable, so sharing its values between copies is safe.
    // `versionsEverySave`: the handlers of the owners save the organisation unchanged so that its version orders their changes, as the adapter does.
    super({
      clone: (stored: Organisation) => Organisation.rehydrate(stored.id, stored.toState()),
      versionsEverySave: true,
    });
  }
}
