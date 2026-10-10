import { describe, expect, it } from '{{tests.module}}';
import { executeRoute } from '@ddd-ts-kit/http';
import { {{route.busClass}} } from '@ddd-ts-kit/kernel';
{{route.messageImport}}
import { {{name.camel}}Route } from '../../presentation/http/{{name.kebab}}.route.js';

describe('{{route.method}} {{route.path}}', () => {
  it('answers {{route.status}} when the use case succeeds', async () => {
    {{#if route.isPlainQuery}}
    const {{route.bus}} = new {{route.busClass}}().register({{route.input}}, {
      execute: async () => ({}),
    });
    {{/if}}
    {{#if route.isList}}
    const {{route.bus}} = new {{route.busClass}}().register({{route.input}}, {
      execute: async () => ({ items: [{ id: '{{name.kebab}}-1' }], total: 1 }),
    });
    {{/if}}
    {{#if route.returnsId}}
    const {{route.bus}} = new {{route.busClass}}().register({{route.input}}, {
      execute: async () => '{{name.kebab}}-1',
    });
    {{/if}}
    {{#if route.returnsNothing}}
    const {{route.bus}} = new {{route.busClass}}().register({{route.input}}, {
      execute: async () => undefined,
    });
    {{/if}}

    const response = await executeRoute(
      {{name.camel}}Route({{route.bus}}),
      { params: {{route.sampleParams}}, query: {}, headers: {}, body: {}, raw: undefined },
      { validateResponses: true },
    );

    expect(response.status).toBe({{route.status}});
  });

  // TODO(domain): replace each entry below by a test of the contract a client relies on.
  it.todo('refuses an input that does not have the expected shape with 422');
  it.todo('answers the documented status for each error code of the use case');
});
