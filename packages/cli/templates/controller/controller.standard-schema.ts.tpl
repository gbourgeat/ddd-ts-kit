import { {{route.httpImports}} } from '@ddd-ts-kit/http';
import type { {{route.busType}} } from '@ddd-ts-kit/kernel';
{{#if route.usesInfer}}
import type { Infer } from '@ddd-ts-kit/validation';
{{/if}}
{{#if route.usesSchema}}
import { standardSchema, type StandardSchemaV1 } from '@ddd-ts-kit/validation/standard-schema';
{{/if}}
{{route.imports}}

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
{{#if route.hasBody}}
// TODO(domain): replace `anyObject` by the schema of "{{name.words}}" written with your Standard Schema library (shape constraints only; business rules stay in the domain) and describe it in the JSON Schema next to it.
const body = standardSchema(anyObject, { type: 'object' });

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
@Controller({
  {{route.access}}
  method: '{{route.method}}',
  path: '{{route.groupPath}}',
  summary: '{{name.title}}',
  {{#if route.hasTypedParams}}
  params,
  {{/if}}
  {{#if route.hasBody}}
  body,
  {{/if}}
  {{#if route.returnsId}}
  response: { status: {{route.status}}, description: 'Done; the body carries the identifier.', body: {{route.acceptedBody}} },
  {{/if}}
  {{#if route.returnsNothing}}
  response: { status: {{route.status}}, description: 'Done.' },
  {{/if}}
  {{#if route.isQuery}}
  response: { status: {{route.status}}, description: 'The answer.', body: answer },
  {{/if}}
  // TODO(domain): list the codes of the refusals "{{name.words}}" can raise, as their factories set them, so that they appear in the contract with their status (`errors/known-code`).
  errors: [],
  {{#if route.cached}}
  cache: {{route.cache}},
  {{/if}}
})
export class {{name.pascal}}Controller {
  constructor({{route.constructorParams}}) {}

  {{#if route.isQuery}}
  async handle({{route.requestParam}}): Promise<{{route.answerType}}> {
    {{#unless route.mapper}}
    // TODO(domain): build the query from `request` (params, query string); the actor is already there.
    {{/unless}}
    {{#if route.serializer}}
    return this.serializer.serialize(await this.{{route.bus}}.execute({{route.message}}));
    {{/if}}
    {{#unless route.serializer}}
    // TODO(domain): map the answer of the query to the public fields.
    await this.{{route.bus}}.execute({{route.message}});

    return {};
    {{/unless}}
  }
  {{/if}}
  {{#if route.returnsId}}
  async handle({{route.requestParam}}): Promise<{{route.acceptedType}}> {
    {{#unless route.mapper}}
    // TODO(domain): build the command from `request` (body, params); the actor is already there.
    {{/unless}}
    const id = await this.{{route.bus}}.execute({{route.message}});

    return { id };
  }
  {{/if}}
  {{#if route.returnsNothing}}
  async handle({{route.requestParam}}): Promise<void> {
    {{#unless route.mapper}}
    // TODO(domain): build the command from `request` (body, params); the actor is already there.
    {{/unless}}
    await this.{{route.bus}}.execute({{route.message}});
  }
  {{/if}}
}
