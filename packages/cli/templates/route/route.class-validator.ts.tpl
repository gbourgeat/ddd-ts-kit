{{#if route.protected}}
import { actorOf } from '@ddd-ts-kit/auth';
{{/if}}
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { {{route.busType}} } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
{{route.useCaseImport}}
{{#if route.hasDto}}
import { {{route.dtoNames}} } from './{{name.kebab}}.dto.js';
{{/if}}

{{#if route.hasParams}}
const params = classSchema({{name.pascal}}Params);
{{/if}}
{{#if route.hasBody}}
// TODO(domain): once {{name.pascal}}Body has its decorated fields, drop the second argument: it only lets a class without any decorated field through.
const body = classSchema({{name.pascal}}Body, { validator: { forbidUnknownValues: false } });
{{/if}}
{{#if route.returnsId}}
const accepted = classSchema({{name.pascal}}Accepted);
{{/if}}
{{#if route.isQuery}}
// TODO(domain): once {{name.pascal}}Answer has its decorated fields, drop the second argument: it only lets a class without any decorated field through.
const answer = classSchema({{name.pascal}}Answer, { validator: { forbidUnknownValues: false } });
{{/if}}

export function {{name.camel}}Route({{route.bus}}: {{route.busType}}): Route {
  return defineRoute(
    {
      method: '{{route.method}}',
      path: '{{route.path}}',
      operationId: '{{name.camel}}',
      summary: '{{name.title}}',
      tags: ['{{context.kebab}}'],
{{#if route.hasRequest}}
      request: { {{route.requestParts}} },
{{/if}}
{{#if route.returnsId}}
      responses: { {{route.status}}: { description: 'Done; the body carries the identifier.', body: accepted } },
{{/if}}
{{#if route.returnsNothing}}
      responses: { {{route.status}}: { description: 'Done.' } },
{{/if}}
{{#if route.isQuery}}
      responses: { {{route.status}}: { description: 'The answer.', body: answer } },
{{/if}}
      // TODO(domain): list the codes of the DomainErrors "{{name.words}}" can raise, so that they appear in the contract with their status.
      errors: [{{route.errorCodes}}],
      security: {{route.security}},
    },
    async (input) => {
{{#if route.isQuery}}
      // TODO(domain): build the query from `input` (params, query string); the actor is already there and map its answer to the public fields.
      await {{route.bus}}.execute(new {{route.input}}({{route.actor}}));
      return { status: {{route.status}}, body: {} };
{{/if}}
{{#if route.returnsId}}
      // TODO(domain): build the command from `input` (body, params); the actor is already there.
      const id = await {{route.bus}}.execute(new {{route.input}}({{route.actor}}));
      return { status: {{route.status}}, body: { id } };
{{/if}}
{{#if route.returnsNothing}}
      // TODO(domain): build the command from `input` (body, params); the actor is already there.
      await {{route.bus}}.execute(new {{route.input}}({{route.actor}}));
      return { status: {{route.status}} };
{{/if}}
    },
  );
}
