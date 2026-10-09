import { describe, expect, it } from '{{tests.module}}';
import { {{event.pascal}}EventHandler } from '../../application/event-handlers/{{event.kebab}}.event-handler.js';
import { {{event.pascal}} } from '../../domain/events/{{event.kebab}}.event.js';

describe('When {{event.words}}', () => {
  it('reacts without failing', async () => {
    const handler = new {{event.pascal}}EventHandler();
    const event = new {{event.pascal}}('{{aggregate.kebab}}-1', new Date('2026-01-01T00:00:00.000Z'));

    await expect(handler.handle(event)).resolves.toBeUndefined();
  });

  // TODO(domain): replace each entry below by a test named after the policy this reaction implements.
  it.todo('carries out the policy that follows the fact');
  it.todo('does nothing when the policy does not apply');
});
