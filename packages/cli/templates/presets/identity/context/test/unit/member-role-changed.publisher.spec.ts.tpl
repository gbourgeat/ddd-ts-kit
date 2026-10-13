import { describe, expect, it } from '{{tests.module}}';
import { InMemoryEventBus, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { MemberRoleChangedPublisher } from '{{alias.context}}/application/integration/publishers/member-role-changed.publisher{{alias.ext}}';
import { MemberRoleChanged } from '{{alias.context}}/domain/events/member-role-changed.event{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

const at = new Date('2026-01-01T00:00:00.000Z');

describe('Publishing "member role changed" to other contexts', () => {
  it('publishes version 1 of {{context.kebab}}.member.role-changed, every field of its payload', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new MemberRoleChangedPublisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(new MemberRoleChanged('member-1', at, { organisationId: 'acme', accountId: 'subject-ada', from: MemberRole.Member, to: MemberRole.Admin }));

    expect(bus.published).toMatchObject([
      {
        id: 'event-1',
        type: '{{context.kebab}}.member.role-changed',
        version: 1,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { memberId: 'member-1', organisationId: 'acme', accountId: 'subject-ada', from: 'member', to: 'admin' },
      },
    ]);
  });
{{#if tenancy.any}}

  it('names the organisation as the tenant of the fact, so that its consumers run in it', async () => {
    const bus = new InMemoryEventBus();

    await new MemberRoleChangedPublisher(bus, new SequentialIdGenerator('event')).handle(new MemberRoleChanged('member-1', at, { organisationId: 'acme', accountId: 'subject-ada', from: MemberRole.Member, to: MemberRole.Admin }));

    expect(bus.published[0]?.tenantId).toBe('acme');
  });
{{/if}}
});
