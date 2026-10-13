import Type from 'typebox';
{{#if route.protected}}
import { actorOf } from '@ddd-ts-kit/auth';
{{/if}}
import { {{#if route.sharedAccepted}}acceptedSchema, {{/if}}defineRoute, type Route } from '@ddd-ts-kit/http';
import type { {{route.busType}} } from '@ddd-ts-kit/kernel';
import { typeboxSchema } from '@ddd-ts-kit/validation/typebox';
{{route.useCaseImport}}

{{#if route.hasParams}}
const params = typeboxSchema(Type.Object({ {{route.typeboxParams}} }));

{{/if}}
{{#if route.hasBody}}
const body = typeboxSchema(
  Type.Object({
    // TODO(domain): declare the fields the client sends for "{{name.words}}", with shape constraints only (types, formats, lengths); business rules stay in the domain.
  }),
);

{{/if}}
{{#if route.ownAccepted}}
const accepted = typeboxSchema(Type.Object({ id: Type.String() }));

{{/if}}
{{#if route.isQuery}}
const answer = typeboxSchema(
  Type.Object({
    // TODO(domain): declare the fields of {{name.pascal}}Result that are part of the public contract.
  }),
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
