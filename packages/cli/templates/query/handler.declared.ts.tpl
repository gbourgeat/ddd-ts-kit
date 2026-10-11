import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { {{name.pascal}}Reader } from '{{alias.context}}/application/ports/{{name.kebab}}-reader.port{{alias.ext}}';
import { {{name.pascal}}Query } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.query{{alias.ext}}';
import type { {{name.pascal}}Result } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.result{{alias.ext}}';

@QueryHandler({{name.pascal}}Query, [{{name.pascal}}Reader])
export class {{name.pascal}}Handler implements QueryHandler<{{name.pascal}}Query> {
  constructor(private readonly reader: {{name.pascal}}Reader) {}

  async execute(query: {{name.pascal}}Query): Promise<{{name.pascal}}Result> {
    // TODO(domain): narrow what is read to what the asker may see: ask `Access.scope(query.actor, permission, '<type>')` for the scope and hand it to the reader, never filter in memory after loading; a query never changes state.
    return this.reader.read(query);
  }
}
