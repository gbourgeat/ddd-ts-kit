import { ACCESS, type Access } from '@ddd-ts-kit/auth';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { {{context.camel}}Permissions } from '../../authorization/{{context.kebab}}.permissions.js';
import { {{name.constant}}_READER } from '../../ports/{{context.kebab}}.ports.js';
import type { {{name.pascal}}Reader } from '../../ports/{{name.kebab}}-reader.port.js';
import { {{name.pascal}}Query, type {{name.pascal}}Result } from './{{name.kebab}}.query.js';

@QueryHandler({{name.pascal}}Query, [{{name.constant}}_READER, ACCESS])
export class {{name.pascal}}Handler implements QueryHandler<{{name.pascal}}Query> {
  constructor(
    private readonly reader: {{name.pascal}}Reader,
    private readonly access: Access,
  ) {}

  async execute(query: {{name.pascal}}Query): Promise<{{name.pascal}}Result> {
    // TODO(domain): name the listed element as the authorization model knows it, in place of '{{list.resource}}'; the scope it answers is handed to the read port, which filters in the statement and never in memory after loading.
    const scope = await this.access.scope(query.actor, {{context.camel}}Permissions['{{access.permission}}'], '{{list.resource}}');
    return this.reader.list(scope, query.page);
  }
}
