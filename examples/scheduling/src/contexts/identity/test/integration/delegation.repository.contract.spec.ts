import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  FixedClock,
  FixedExecutionScope,
  executionContext,
  type Actor,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import type { Delegation } from '@/contexts/identity/domain/aggregates/delegation.aggregate';
import type { DelegationRepository } from '@/contexts/identity/domain/repositories/delegation.repository';
import { Desk } from '@/contexts/identity/domain/value-objects/desk.vo';
import { KnexDelegationRepository } from '@/contexts/identity/infrastructure/persistence/knex-delegation.repository';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { aDelegation } from '@/contexts/identity/test/builders/delegation.builder';
import { FakeDelegationRepository } from '@/contexts/identity/test/fakes/delegation.repository.fake';

const runner = { describe, it, expect, beforeEach, afterEach };

const expectations = {
  createAggregate: () => aDelegation().build(),
  mutate: (changed: Delegation) => {
    changed.revoke(new Date('2026-02-01T00:00:00.000Z'));
  },
  idOf: (subject: Delegation) => subject.id,
  stateOf: (subject: Delegation) => subject.toState(),
};

repositoryContract<Delegation>(runner, {
  ...expectations,
  name: 'FakeDelegationRepository',
  createRepository: () => new FakeDelegationRepository(),
});

const clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

repositoryContract<Delegation>(runner, {
  ...expectations,
  name: 'KnexDelegationRepository',
  createRepository: async () => {
    await database.reset();

    return new KnexDelegationRepository(database.persistence.database, new FixedExecutionScope(workOf('acme')), clock);
  },
});

function workOf(tenantId: string): ExecutionContext {
  const actor: Actor = { id: 'member-of-' + tenantId, type: 'user', tenantId, roles: [], attributes: {} };

  return executionContext({ correlationId: 'contract-spec', actor, origin: 'test' });
}

describe.each([
  ['FakeDelegationRepository', async (): Promise<DelegationRepository> => new FakeDelegationRepository()],
  ['KnexDelegationRepository', knexRepository],
])('The lookups of %s', (_name, createRepository) => {
  const grantedAt = new Date('2026-01-01T00:00:00.000Z');
  const end = new Date('2026-04-01T00:00:00.000Z');
  const onDesk = aDelegation().bornAt(grantedAt).onDesk('practice-1', 'grace');

  it('finds the active delegation between a desk and an assistant, and none once it ended', async () => {
    const repository = await createRepository();

    await repository.save(onDesk.identifiedBy('ended').givenTo('linus').revokedAt(end).build());
    await repository.save(onDesk.identifiedBy('active').givenTo('linus').build());
    await repository.save(onDesk.identifiedBy('ended-only').givenTo('marie').revokedAt(end).build());

    const active = await repository.findActiveBetween(Desk.create('practice-1', 'grace'), 'linus');
    const none = await repository.findActiveBetween(Desk.create('practice-1', 'grace'), 'marie');
    const elsewhere = await repository.findActiveBetween(Desk.create('practice-2', 'grace'), 'linus');

    expect([active?.id, none, elsewhere]).toEqual(['active', undefined, undefined]);
  });

  it('finds the active delegations a member gave or received in one practice', async () => {
    const repository = await createRepository();

    await repository.save(onDesk.identifiedBy('given').givenTo('linus').build());

    await repository.save(
      aDelegation().identifiedBy('received').onDesk('practice-1', 'marie').givenTo('grace').build(),
    );

    await repository.save(onDesk.identifiedBy('given-ended').givenTo('alan').revokedAt(end).build());

    await repository.save(
      aDelegation().identifiedBy('elsewhere').onDesk('practice-2', 'grace').givenTo('linus').build(),
    );

    await repository.save(
      aDelegation().identifiedBy('of-others').onDesk('practice-1', 'marie').givenTo('linus').build(),
    );

    const found = await repository.findActiveOfMember('practice-1', 'grace');

    expect(found.map((delegation) => delegation.id).sort()).toEqual(['given', 'received']);
  });

  it('finds the active delegations whose end is reached, the end itself included', async () => {
    const repository = await createRepository();

    await repository.save(onDesk.identifiedBy('due').givenTo('linus').endingAt(end).build());

    await repository.save(
      onDesk.identifiedBy('later').givenTo('marie').endingAt(new Date('2026-04-01T00:00:01.000Z')).build(),
    );

    await repository.save(onDesk.identifiedBy('open').givenTo('alan').build());

    await repository.save(
      onDesk
        .identifiedBy('due-ended')
        .givenTo('rosalind')
        .endingAt(end)
        .revokedAt(new Date('2026-02-01T00:00:00.000Z'))
        .build(),
    );

    const due = await repository.findDueAt(end);

    expect(due.map((delegation) => delegation.id)).toEqual(['due']);
  });

  it('stores every term of a delegation and the way it ended', async () => {
    const repository = await createRepository();

    const saved = onDesk
      .identifiedBy('whole')
      .givenTo('linus')
      .includingAvailability()
      .endingAt(end)
      .revokedAt(new Date('2026-02-01T00:00:00.000Z'))
      .build();

    await repository.save(saved);

    const loaded = await repository.findById('whole');

    expect(loaded?.toState()).toEqual(saved.toState());
  });
});

async function knexRepository(): Promise<DelegationRepository> {
  await database.reset();

  return new KnexDelegationRepository(database.persistence.database, new FixedExecutionScope(workOf('acme')), clock);
}
