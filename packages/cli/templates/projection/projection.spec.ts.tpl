import { describe, expect, it } from '{{tests.module}}';
import { {{event.definition}} } from '{{alias.contexts}}/{{publisher.kebab}}/published-language/index{{alias.ext}}';
import { {{name.pascal}}Projection } from '{{alias.context}}/application/projections/{{name.kebab}}.projection{{alias.ext}}';

describe('{{name.title}}, kept from what {{publisher.kebab}} announces', () => {
  it('receives {{event.type}} as {{publisher.kebab}} publishes it', async () => {
    const projection = new {{name.pascal}}Projection();
    // TODO(domain): give the payload every field {{publisher.kebab}} declares, hand the projection the fake of its read model and assert the line it keeps.
    const event = {{event.definition}}.create({ {{event.payloadKey}}: '{{event.payloadSample}}' }, { id: 'event-1', occurredAt: '2026-01-01T00:00:00.000Z' });

    await expect(projection.{{event.method}}(event)).resolves.toBeUndefined();
  });

  // TODO(domain): replace each entry below by a test that publishes events through the test application, with the fake of the read model bound to its port, and asserts the line that is kept.
  it.todo('keeps the same line when the same event is delivered twice');
  it.todo('keeps the newest line when an older event is delivered late');
});
