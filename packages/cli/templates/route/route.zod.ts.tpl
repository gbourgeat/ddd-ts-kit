import { z } from 'zod';
{{#if route.protected}}
import { actorOf } from '@ddd-ts-kit/auth';
{{/if}}
import { {{#if route.sharedAccepted}}acceptedSchema, {{/if}}defineRoute, type Route } from '@ddd-ts-kit/http';
import type { {{route.busType}} } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
{{route.useCaseImport}}

{{#if route.hasParams}}
const params = zodSchema(z.object({ {{route.zodParams}} }));

{{/if}}
{{#if route.hasBody}}
{{#if route.writesBody}}
{{route.bodyDeclaration}}

{{/if}}
{{#unless route.writesBody}}
const body = zodSchema(
  z.object({
    // TODO(domain): declare the fields the client sends for "{{name.words}}", with shape constraints only (types, formats, lengths); business rules stay in the domain.
  }),
);

{{/unless}}
{{/if}}
{{#if route.ownAccepted}}
const accepted = zodSchema(z.object({ id: z.string() }), { io: 'output' });

{{/if}}
{{#if route.isQuery}}
const answer = zodSchema(
  z.object({
    // TODO(domain): declare the fields of {{name.pascal}}Result that are part of the public contract.
  }),
  { io: 'output' },
);

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
      responses: { {{route.status}}: { description: 'Done; the body carries the identifier.', body: {{route.acceptedBody}} } },
      {{/if}}
      {{#if route.returnsNothing}}
      responses: { {{route.status}}: { description: 'Done.' } },
      {{/if}}
      {{#if route.isQuery}}
      responses: { {{route.status}}: { description: 'The answer.', body: answer } },
      {{/if}}
      // TODO(domain): list the codes of the refusals "{{name.words}}" can raise, as their factories set them, so that they appear in the contract with their status (`errors/known-code`).
      errors: [{{route.errorCodes}}],
      security: {{route.security}},
    },
    async (input) => {
      {{#if route.isQuery}}
      {{#unless route.readsMessage}}
      // TODO(domain): build the query from `input` (params, query string); the actor is already there and map its answer to the public fields.
      {{/unless}}
      {{#if route.readsMessage}}
      // TODO(domain): map the answer of the query to the public fields.
      {{/if}}
      await {{route.bus}}.execute({{route.routeMessage}});

      return { status: {{route.status}}, body: {} };
      {{/if}}
      {{#if route.returnsId}}
      {{#unless route.readsMessage}}
      // TODO(domain): build the command from `input` (body, params); the actor is already there.
      {{/unless}}
      const id = await {{route.bus}}.execute({{route.routeMessage}});

      return { status: {{route.status}}, body: { id } };
      {{/if}}
      {{#if route.returnsNothing}}
      {{#unless route.readsMessage}}
      // TODO(domain): build the command from `input` (body, params); the actor is already there.
      {{/unless}}
      await {{route.bus}}.execute({{route.routeMessage}});

      return { status: {{route.status}} };
      {{/if}}
    },
  );
}
