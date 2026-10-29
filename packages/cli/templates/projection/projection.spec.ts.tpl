import { describe, expect, it } from '{{tests.module}}';
import { {{event.definition}} } from '{{alias.contexts}}/{{publisher.kebab}}/published-language{{alias.index}}';
import { {{name.pascal}}Projection } from '{{alias.context}}/application/projections/{{name.kebab}}.projection{{alias.ext}}';

// TODO(domain): give the payload every field {{publisher.kebab}} declares.
const fact = {{event.definition}}.create({ {{event.payloadKey}}: '{{event.payloadSample}}' }, { id: 'event-1', occurredAt: '2026-01-01T00:00:00.000Z' });

describe('{{name.title}}, kept from what {{publisher.kebab}} announces', () => {
  it('keeps the line {{event.type}} says', async () => {
    const projection = new {{name.pascal}}Projection();

    // TODO(domain): hand the projection the fake of its read model and assert the line it keeps, `expect(await readModel.get('<id>')).toEqual({ ... })`, and that it answers `'applied'`.
    await expect(projection.{{event.method}}(fact)).resolves.toBeUndefined();
  });

  // TODO(domain): replace each entry below by a test of the same shape: the fact given, the line kept asserted.
  it.todo('keeps the same line when the same event is delivered twice');
  it.todo('keeps the newest line when an older event is delivered late');
});
