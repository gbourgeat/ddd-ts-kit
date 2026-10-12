import { {{route.httpImports}} } from '@ddd-ts-kit/http';
import type { {{route.busType}} } from '@ddd-ts-kit/kernel';
{{#if route.declaresSchema}}
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
{{/if}}
{{route.imports}}

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
{{#if route.declaresSchema}}

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
