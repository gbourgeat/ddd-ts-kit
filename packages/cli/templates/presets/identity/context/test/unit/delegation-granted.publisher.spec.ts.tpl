import { describe, expect, it } from '{{tests.module}}';
import { InMemoryEventBus, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { DelegationGrantedPublisher } from '{{alias.context}}/application/integration/publishers/delegation-granted.publisher{{alias.ext}}';
import { DelegationGranted } from '{{alias.context}}/domain/events/delegation-granted.event{{alias.ext}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';

const at = new Date('2026-01-01T00:00:00.000Z');

describe('Publishing "delegation granted" to other contexts', () => {
  it('publishes version 1 of {{context.kebab}}.delegation.granted, every field of its payload', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new DelegationGrantedPublisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(new DelegationGranted('delegation-1', at, { organisationId: 'acme', delegatorId: 'subject-ada', delegateId: 'subject-grace', rights: [MemberRight.InviteMembers], startsAt: at, endsAt: new Date('2026-01-15T00:00:00.000Z') }));

    expect(bus.published).toMatchObject([
      {
        id: 'event-1',
        type: '{{context.kebab}}.delegation.granted',
        version: 1,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { delegationId: 'delegation-1', organisationId: 'acme', delegatorId: 'subject-ada', delegateId: 'subject-grace', rights: ['invite-members'], startsAt: '2026-01-01T00:00:00.000Z', endsAt: '2026-01-15T00:00:00.000Z' },
      },
    ]);
  });
{{#if tenancy.any}}

  it('names the organisation as the tenant of the fact, so that its consumers run in it', async () => {
    const bus = new InMemoryEventBus();

    await new DelegationGrantedPublisher(bus, new SequentialIdGenerator('event')).handle(new DelegationGranted('delegation-1', at, { organisationId: 'acme', delegatorId: 'subject-ada', delegateId: 'subject-grace', rights: [MemberRight.InviteMembers], startsAt: at, endsAt: new Date('2026-01-15T00:00:00.000Z') }));

    expect(bus.published[0]?.tenantId).toBe('acme');
  });
{{/if}}
});
