import { {{search.nestImports}} } from '@nestjs/common';
import { {{search.kitImports}} } from '@ddd-ts-kit/http';
import { CurrentActor, KitRoute, KitRoutes } from '@ddd-ts-kit/http/nest';
import { QueryBus, type Actor } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
{{route.imports}}

// TODO(domain): list here the fields of {{name.pascal}}Sort a client may sort by, and bound the size of a page.
const query = pageQuerySchema({ sortable: ['id'], maxSize: 100 });
const line = classSchema({{name.pascal}}Line);

/** Built by Nest with the bus it injects, served by the kit: a page is no DTO class, so @KitRoute gives its query and its answer. */
@Controller()
@KitRoutes({ {{route.nestShared}} })
export class {{name.pascal}}Controller {
  constructor(@Inject(QueryBus) private readonly queries: QueryBus) {}

  @{{route.nestMethod}}({{route.nestPath}})
  @KitRoute({
    request: { query },
    response: { description: 'One page of the search.', body: pageSchemaOf(line) },
    // TODO(domain): list the codes of the refusals "{{name.words}}" can raise, as their factories set them, so that they appear in the contract with their status (`errors/known-code`).
    errors: [],
    {{#if route.cached}}
    cache: {{route.cache}},
    {{/if}}
  })
  async {{name.camel}}(
    @Query() criteria: Infer<typeof query>,
    @CurrentActor() actor: Actor,
  ): Promise<PageBody<Infer<typeof line>>> {
    // TODO(domain): hand the criteria of the query over too, once the query schema declares them next to the page; map each line to its public fields.
    const page = await this.queries.execute(new {{route.input}}(actor, criteria));

    return pageResponse(page, ({{search.element}}) => ({ id: {{search.element}}.id }));
  }
}
