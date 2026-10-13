import { {{route.httpImports}} } from '@ddd-ts-kit/http';
{{#if route.usesSchema}}
import { err, ok, type {{route.busType}} } from '@ddd-ts-kit/kernel';
import { customSchema{{#if route.usesInfer}}, type Infer{{/if}} } from '@ddd-ts-kit/validation';
{{/if}}
{{#unless route.usesSchema}}
import type { {{route.busType}} } from '@ddd-ts-kit/kernel';
{{/unless}}
{{route.imports}}

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
{{#if route.ownAccepted}}
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
