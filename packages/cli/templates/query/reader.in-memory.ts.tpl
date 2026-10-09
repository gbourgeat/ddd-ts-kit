import type { {{name.pascal}}Reader } from '../../application/ports/{{name.kebab}}-reader.port.js';
import type { {{name.pascal}}Query, {{name.pascal}}Result } from '../../application/queries/{{name.kebab}}/{{name.kebab}}.query.js';

export class InMemory{{name.pascal}}Reader implements {{name.pascal}}Reader {
  constructor(private readonly answer: {{name.pascal}}Result) {}

  async read(query: {{name.pascal}}Query): Promise<{{name.pascal}}Result> {
    // TODO(domain): replace this canned answer by a real read of the projection, filtered by `query`; a production adapter (SQL view, search index) implements the same port next to this file.
    return this.answer;
  }
}
