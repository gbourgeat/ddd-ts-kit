{{#if route.protected}}
import { actorOf } from '@ddd-ts-kit/auth';
{{/if}}
import { {{#if route.sharedAccepted}}acceptedSchema, {{/if}}defineRoute, type Route } from '@ddd-ts-kit/http';
import type { {{route.busType}} } from '@ddd-ts-kit/kernel';
{{#if route.usesSchema}}
import { standardSchema, type StandardSchemaV1 } from '@ddd-ts-kit/validation/standard-schema';
{{/if}}
{{route.useCaseImport}}

{{#if route.usesAnyObject}}
const anyObject: StandardSchemaV1<unknown, Record<string, unknown>> = {
  '~standard': {
    version: 1,
    vendor: '{{context.kebab}}',
    validate: (value) =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? { value: { ...value } }
        : { issues: [{ message: 'An object is expected.' }] },
  },
};

{{/if}}
{{#if route.writesParams}}
{{route.paramsDeclaration}}

{{/if}}
{{#if route.hasBody}}
{{#if route.writesBody}}
{{route.bodyDeclaration}}

{{/if}}
{{#unless route.writesBody}}
// TODO(domain): replace `anyObject` by the schema of "{{name.words}}" written with your Standard Schema library (shape constraints only; business rules stay in the domain) and describe it in the JSON Schema next to it.
const body = standardSchema(anyObject, { type: 'object' });

{{/unless}}
{{/if}}
{{#if route.ownAccepted}}
const acceptedShape: StandardSchemaV1<unknown, { readonly id: string }> = {
  '~standard': {
    version: 1,
    vendor: '{{context.kebab}}',
    validate: (value) =>
      typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string'
        ? { value: { id: value.id } }
        : { issues: [{ message: 'An identifier is expected.', path: ['id'] }] },
  },
};

const accepted = standardSchema(acceptedShape, {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string' } },
});

{{/if}}
{{#if route.isQuery}}
// TODO(domain): replace `anyObject` by the schema of the fields of {{name.pascal}}Result that are part of the public contract, and describe it in the JSON Schema next to it.
const answer = standardSchema(anyObject, { type: 'object' });

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
