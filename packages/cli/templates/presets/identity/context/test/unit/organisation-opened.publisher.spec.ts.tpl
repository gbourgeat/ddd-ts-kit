import { describe, expect, it } from '{{tests.module}}';
import { InMemoryEventBus, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { OrganisationOpenedPublisher } from '{{alias.context}}/application/integration/publishers/organisation-opened.publisher{{alias.ext}}';
import { OrganisationOpened } from '{{alias.context}}/domain/events/organisation-opened.event{{alias.ext}}';

const at = new Date('2026-01-01T00:00:00.000Z');

describe('Publishing "organisation opened" to other contexts', () => {
  it('publishes version 1 of {{context.kebab}}.organisation.opened, every field of its payload', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new OrganisationOpenedPublisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(new OrganisationOpened('acme', at, { name: 'Acme', openedBy: 'subject-ada' }));

    expect(bus.published).toMatchObject([
      {
        id: 'event-1',
        type: '{{context.kebab}}.organisation.opened',
        version: 1,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { organisationId: 'acme', name: 'Acme', openedBy: 'subject-ada' },
      },
    ]);
  });
{{#if tenancy.any}}

  it('names the organisation as the tenant of the fact, so that its consumers run in it', async () => {
    const bus = new InMemoryEventBus();

    await new OrganisationOpenedPublisher(bus, new SequentialIdGenerator('event')).handle(new OrganisationOpened('acme', at, { name: 'Acme', openedBy: 'subject-ada' }));

    expect(bus.published[0]?.tenantId).toBe('acme');
  });
{{/if}}
});
