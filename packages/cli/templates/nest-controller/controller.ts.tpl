import { {{route.nestImports}} } from '@nestjs/common';
{{#if route.importsFromTheKit}}
import { {{route.kitImports}} } from '@ddd-ts-kit/http';
{{/if}}
import { {{route.bridgeImports}} } from '@ddd-ts-kit/http/nest';
import { {{route.kernelImports}} } from '@ddd-ts-kit/kernel';
{{#if route.declaresSchema}}
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
{{/if}}
{{route.imports}}

{{#if route.hasParams}}
const paramsSchema = classSchema({{name.pascal}}Params);
{{/if}}
{{#if route.hasBody}}
// TODO(domain): once {{name.pascal}}Body has its decorated fields, drop the second argument: it only lets a class without any decorated field through.
const bodySchema = classSchema({{name.pascal}}Body, { validator: { forbidUnknownValues: false } });
{{/if}}
{{#if route.ownAccepted}}
const accepted = classSchema({{name.pascal}}Accepted);
{{/if}}
{{#if route.isQuery}}
// TODO(domain): once {{name.pascal}}Answer has its decorated fields, drop the second argument: it only lets a class without any decorated field through.
const answer = classSchema({{name.pascal}}Answer, { validator: { forbidUnknownValues: false } });
{{/if}}
{{#if route.declaresSchema}}

{{/if}}
/** Built by Nest with the bus it injects, served by the kit: its route is declared once, by Nest's decorators and @KitRoute. */
@Controller()
@KitRoutes({ {{route.nestShared}} })
export class {{name.pascal}}Controller {
  constructor({{route.nestConstructor}}) {}

  @{{route.nestMethod}}({{route.nestPath}})
  @KitRoute({
    {{#if route.readsRequest}}
    request: { {{route.nestRequest}} },
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
  {{#if route.isQuery}}
  async {{name.camel}}({{route.nestParameters}}): Promise<{{route.answerType}}> {
    // TODO(domain): build the query from the parameters; the caller is already there.
    // TODO(domain): map the answer of the query to the public fields.
    await this.{{route.bus}}.execute({{route.nestMessage}});

    return {};
  }
  {{/if}}
  {{#if route.returnsId}}
  async {{name.camel}}({{route.nestParameters}}): Promise<{{route.acceptedType}}> {
    // TODO(domain): build the command from the parameters (body, params); the caller is already there.
    const id = await this.{{route.bus}}.execute({{route.nestMessage}});

    return { id };
  }
  {{/if}}
  {{#if route.returnsNothing}}
  async {{name.camel}}({{route.nestParameters}}): Promise<void> {
    // TODO(domain): build the command from the parameters (body, params); the caller is already there.
    await this.{{route.bus}}.execute({{route.nestMessage}});
  }
  {{/if}}
}
