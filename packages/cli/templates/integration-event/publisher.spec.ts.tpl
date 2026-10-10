import { describe, expect, it } from '{{tests.module}}';
import { InMemoryEventBus, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { {{publisher.pascal}}Publisher } from '../../application/integration/publishers/{{publisher.kebab}}.publisher.js';
import { {{event.pascal}} } from '../../domain/events/{{event.kebab}}.event.js';

describe('Publishing "{{event.words}}" to other contexts', () => {
  it('publishes version {{event.version}} of {{event.name}}', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new {{publisher.pascal}}Publisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(new {{event.pascal}}('{{aggregate.kebab}}-1', new Date('2026-01-01T00:00:00.000Z')));

    expect(bus.published).toEqual([
      {
        id: 'event-1',
        type: '{{event.name}}',
        version: {{event.version}},
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { {{aggregate.camel}}Id: '{{aggregate.kebab}}-1' },
      },
    ]);
  });

  // TODO(domain): once the payload has its fields, assert each of them here: this test is the contract other contexts rely on.
  it.todo('carries every field of the public payload');
});
