{{#if route.protected}}
import { actorOf } from '@ddd-ts-kit/auth';
{{/if}}
import { defineRoute, type Route } from '@ddd-ts-kit/http';
{{#if route.usesSchema}}
import { err, ok, type {{route.busType}} } from '@ddd-ts-kit/kernel';
import { customSchema } from '@ddd-ts-kit/validation';
{{/if}}
{{#unless route.usesSchema}}
import type { {{route.busType}} } from '@ddd-ts-kit/kernel';
{{/unless}}
{{route.useCaseImport}}

{{#if route.usesAnyObject}}
const anyObject = customSchema<Record<string, unknown>>(
  (input) =>
    typeof input === 'object' && input !== null && !Array.isArray(input)
      ? ok({ ...input })
      : err([{ path: '', code: 'invalid_type', message: 'An object is expected.' }]),
  { type: 'object' },
);

{{/if}}
{{#if route.hasBody}}
// TODO(domain): replace `anyObject` by a schema checking the fields the client sends for "{{name.words}}" (shape constraints only; business rules stay in the domain) and describing them in JSON Schema.
const body = anyObject;

{{/if}}
{{#if route.returnsId}}
const accepted = customSchema<{ readonly id: string }>(
  (input) =>
    typeof input === 'object' && input !== null && 'id' in input && typeof input.id === 'string'
      ? ok({ id: input.id })
      : err([{ path: 'id', code: 'invalid_type', message: 'An identifier is expected.' }]),
  { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
);

{{/if}}
{{#if route.isQuery}}
// TODO(domain): replace `anyObject` by a schema of the fields of {{name.pascal}}Result that are part of the public contract.
const answer = anyObject;

{{/if}}
export function {{name.camel}}Route({{route.bus}}: {{route.busType}}): Route {
  return defineRoute(
    {
      method: '{{route.method}}',
      path: '{{route.path}}',
      operationId: '{{name.camel}}',
      summary: '{{name.title}}',
      tags: ['{{context.kebab}}'],
      {{#if route.hasBody}}
      request: { body },
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
