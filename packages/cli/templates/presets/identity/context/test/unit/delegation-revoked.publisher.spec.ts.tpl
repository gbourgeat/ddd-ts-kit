import { describe, expect, it } from '{{tests.module}}';
import { InMemoryEventBus, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { DelegationRevokedPublisher } from '{{alias.context}}/application/integration/publishers/delegation-revoked.publisher{{alias.ext}}';
import { DelegationRevoked } from '{{alias.context}}/domain/events/delegation-revoked.event{{alias.ext}}';

const at = new Date('2026-01-01T00:00:00.000Z');

describe('Publishing "delegation revoked" to other contexts', () => {
  it('publishes version 1 of {{context.kebab}}.delegation.revoked, every field of its payload', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new DelegationRevokedPublisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(new DelegationRevoked('delegation-1', at, { organisationId: 'acme', delegatorId: 'subject-ada', delegateId: 'subject-grace' }));

    expect(bus.published).toMatchObject([
      {
        id: 'event-1',
        type: '{{context.kebab}}.delegation.revoked',
        version: 1,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { delegationId: 'delegation-1', organisationId: 'acme', delegatorId: 'subject-ada', delegateId: 'subject-grace' },
      },
    ]);
  });
{{#if tenancy.any}}

  it('names the organisation as the tenant of the fact, so that its consumers run in it', async () => {
    const bus = new InMemoryEventBus();

    await new DelegationRevokedPublisher(bus, new SequentialIdGenerator('event')).handle(new DelegationRevoked('delegation-1', at, { organisationId: 'acme', delegatorId: 'subject-ada', delegateId: 'subject-grace' }));

    expect(bus.published[0]?.tenantId).toBe('acme');
  });
{{/if}}
});
