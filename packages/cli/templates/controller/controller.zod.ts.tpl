{{#if route.declaresSchema}}
import { z } from 'zod';
{{/if}}
import { {{route.httpImports}} } from '@ddd-ts-kit/http';
import type { {{route.busType}} } from '@ddd-ts-kit/kernel';
{{#if route.usesInfer}}
import type { Infer } from '@ddd-ts-kit/validation';
{{/if}}
{{#if route.declaresSchema}}
import { zodSchema } from '@ddd-ts-kit/validation/zod';
{{/if}}
{{route.imports}}

{{#if route.hasParams}}
const params = zodSchema(z.object({ {{route.zodParams}} }));

{{/if}}
{{#if route.hasBody}}
const body = zodSchema(
  z.object({
    // TODO(domain): declare the fields the client sends for "{{name.words}}", with shape constraints only (types, formats, lengths); business rules stay in the domain.
  }),
);

{{/if}}
{{#if route.returnsId}}
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
  response: { status: {{route.status}}, description: 'Done; the body carries the identifier.', body: accepted },
  {{/if}}
  {{#if route.returnsNothing}}
  response: { status: {{route.status}}, description: 'Done.' },
  {{/if}}
  {{#if route.isQuery}}
  response: { status: {{route.status}}, description: 'The answer.', body: answer },
  {{/if}}
  // TODO(domain): list the codes of the refusals "{{name.words}}" can raise, as their factories set them, so that they appear in the contract with their status (`errors/known-code`).
  errors: [],
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
