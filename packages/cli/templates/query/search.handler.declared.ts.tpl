import type { Access } from '@ddd-ts-kit/auth';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';
import type { {{name.pascal}}Reader } from '{{alias.context}}/application/ports/{{name.kebab}}-reader.port{{alias.ext}}';
import { {{name.pascal}}Query } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.query{{alias.ext}}';
import type { {{name.pascal}}Result } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.result{{alias.ext}}';

@QueryHandler({{name.pascal}}Query)
export class {{name.pascal}}Handler implements QueryHandler<{{name.pascal}}Query> {
  constructor(
    private readonly reader: {{name.pascal}}Reader,
    private readonly access: Access,
  ) {}

  async execute(query: {{name.pascal}}Query): Promise<{{name.pascal}}Result> {
    // TODO(domain): name the searched element as the authorization model knows it, in place of '{{search.resource}}'; the scope it answers is handed to the read port, which filters in the statement and never in memory after loading.
    const scope = await this.access.scope(query.actor, {{context.camel}}Permissions['{{access.permission}}'], '{{search.resource}}');

    return this.reader.search(scope, query.page);
  }
}
