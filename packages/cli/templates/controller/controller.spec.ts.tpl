import { describe, expect, it } from '{{tests.module}}';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { {{route.busClass}}{{#if route.protected}}, type Actor{{/if}} } from '@ddd-ts-kit/kernel';
{{route.messageImport}}
{{route.specImports}}

{{#if route.protected}}
const caller: Actor = { id: 'user-1', type: 'user', roles: [], attributes: {} };

{{/if}}
describe('{{route.method}} {{route.path}}', () => {
  it('answers {{route.status}} when the use case succeeds', async () => {
    {{#if route.isPlainQuery}}
    const {{route.bus}} = new {{route.busClass}}().register({{route.input}}, {
      execute: async () => ({}),
    });
    {{/if}}
    {{#if route.isSearch}}
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

    const route = controllerRoute(new {{name.pascal}}Controller({{route.specArguments}}));

    const response = await executeRoute(
      route,
      { params: {{route.sampleParams}}, query: {}, headers: {}, body: {}, raw: undefined },
      { validateResponses: true{{#if route.protected}}, resolvePrincipal: () => caller{{/if}} },
    );

    expect(response.status).toBe({{route.status}});
    expect(route.path).toBe('{{route.path}}');
  });

  // TODO(domain): replace each entry below by a test of the contract a client relies on.
  it.todo('refuses an input that does not have the expected shape with 422');
  it.todo('answers the documented status for each error code of the use case');
});
