import { describe, expect, it } from '{{tests.module}}';
import { InMemoryEventBus, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { MemberRemovedPublisher } from '{{alias.context}}/application/integration/publishers/member-removed.publisher{{alias.ext}}';
import { MemberRemoved } from '{{alias.context}}/domain/events/member-removed.event{{alias.ext}}';

const at = new Date('2026-01-01T00:00:00.000Z');

describe('Publishing "member removed" to other contexts', () => {
  it('publishes version 1 of {{context.kebab}}.member.removed, every field of its payload', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new MemberRemovedPublisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(new MemberRemoved('member-1', at, { organisationId: 'acme', accountId: 'subject-ada' }));

    expect(bus.published).toMatchObject([
      {
        id: 'event-1',
        type: '{{context.kebab}}.member.removed',
        version: 1,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { memberId: 'member-1', organisationId: 'acme', accountId: 'subject-ada' },
      },
    ]);
  });
{{#if tenancy.any}}

  it('names the organisation as the tenant of the fact, so that its consumers run in it', async () => {
    const bus = new InMemoryEventBus();

    await new MemberRemovedPublisher(bus, new SequentialIdGenerator('event')).handle(new MemberRemoved('member-1', at, { organisationId: 'acme', accountId: 'subject-ada' }));

    expect(bus.published[0]?.tenantId).toBe('acme');
  });
{{/if}}
});
