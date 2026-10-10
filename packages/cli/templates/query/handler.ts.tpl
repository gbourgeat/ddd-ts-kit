import type { QueryHandler } from '@ddd-ts-kit/kernel';
import type { {{name.pascal}}Reader } from '../../ports/{{name.kebab}}-reader.port.js';
import type { {{name.pascal}}Query } from './{{name.kebab}}.query.js';
import type { {{name.pascal}}Result } from './{{name.kebab}}.result.js';

export class {{name.pascal}}Handler implements QueryHandler<{{name.pascal}}Query> {
  constructor(private readonly reader: {{name.pascal}}Reader) {}

  async execute(query: {{name.pascal}}Query): Promise<{{name.pascal}}Result> {
    // TODO(domain): narrow what is read to what the asker may see: ask `Access.scope(query.actor, permission, '<type>')` for the scope and hand it to the reader, never filter in memory after loading; a query never changes state.
    return this.reader.read(query);
  }
}
