import { describe, expect, it } from '{{tests.module}}';
import { {{event.pascal}} } from '{{alias.context}}/domain/events/{{event.kebab}}.event.js';

describe('{{event.pascal}}', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new {{event.pascal}}('{{aggregate.kebab}}-1', new Date('2026-01-01T00:00:00.000Z'));

    expect(event.name).toBe('{{event.name}}');
    expect(event.aggregateId).toBe('{{aggregate.kebab}}-1');
  });
});
