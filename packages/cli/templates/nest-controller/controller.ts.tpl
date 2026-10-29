import { {{route.nestImports}} } from '@nestjs/common';
{{#if route.importsFromTheKit}}
import { {{route.kitImports}} } from '@ddd-ts-kit/http';
{{/if}}
import { {{route.bridgeImports}} } from '@ddd-ts-kit/http/nest';
import { {{route.kernelImports}} } from '@ddd-ts-kit/kernel';
{{route.imports}}

/** Built by Nest with the bus it injects, served by the kit: what each method takes and answers is read from its signature. */
@Controller()
@KitRoutes({ {{route.nestShared}} })
export class {{name.pascal}}Controller {
  constructor({{route.nestConstructor}}) {}

  @{{route.nestMethod}}({{route.nestPath}})
  {{#if route.hasHttpCode}}
  @HttpCode({{route.nestHttpCode}})
  {{/if}}
  @KitRoute({
    // TODO(domain): list the codes of the refusals "{{name.words}}" can raise, as their factories set them, so that they appear in the contract with their status (`errors/known-code`).
    errors: [],
    {{#if route.cached}}
    cache: {{route.cache}},
    {{/if}}
  })
  {{#if route.isQuery}}
  async {{name.camel}}({{route.nestParameters}}): Promise<{{route.answerType}}> {
    {{#unless route.readsMessage}}
    // TODO(domain): build the query from the parameters; the caller is already there.
    {{/unless}}
    // TODO(domain): map the answer of the query to the public fields.
    await this.{{route.bus}}.execute({{route.nestMessage}});

    return {};
  }
  {{/if}}
  {{#if route.returnsId}}
  async {{name.camel}}({{route.nestParameters}}): Promise<{{route.acceptedType}}> {
    {{#unless route.readsMessage}}
    // TODO(domain): build the command from the parameters (body, params); the caller is already there.
    {{/unless}}
    const id = await this.{{route.bus}}.execute({{route.nestMessage}});

    return { id };
  }
  {{/if}}
  {{#if route.returnsNothing}}
  async {{name.camel}}({{route.nestParameters}}): Promise<void> {
    {{#unless route.readsMessage}}
    // TODO(domain): build the command from the parameters (body, params); the caller is already there.
    {{/unless}}
    await this.{{route.bus}}.execute({{route.nestMessage}});
  }
  {{/if}}
}
