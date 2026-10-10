import type { Access } from '@ddd-ts-kit/auth';
import type { QueryHandler } from '@ddd-ts-kit/kernel';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions.js';
import type { {{name.pascal}}Reader } from '{{alias.context}}/application/ports/{{name.kebab}}-reader.port.js';
import type { {{name.pascal}}Query } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.query.js';
import type { {{name.pascal}}Result } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.result.js';

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
