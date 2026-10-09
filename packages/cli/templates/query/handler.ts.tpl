import type { QueryHandler } from '@ddd-ts-kit/kernel';
import type { {{name.pascal}}Reader } from '../../ports/{{name.kebab}}-reader.port.js';
import type { {{name.pascal}}Query, {{name.pascal}}Result } from './{{name.kebab}}.query.js';

export class {{name.pascal}}Handler implements QueryHandler<{{name.pascal}}Query> {
  constructor(private readonly reader: {{name.pascal}}Reader) {}

  async execute(query: {{name.pascal}}Query): Promise<{{name.pascal}}Result> {
    // TODO(domain): enforce here what the asker is allowed to see (for example narrow `query` to their own data) before reading; a query never changes state.
    return this.reader.read(query);
  }
}
