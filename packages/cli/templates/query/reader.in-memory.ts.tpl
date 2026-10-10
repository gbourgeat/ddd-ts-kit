{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { {{name.pascal}}Reader } from '../../application/ports/{{name.kebab}}-reader.port.js';
{{/if}}
{{#unless style.declared}}
import type { {{name.pascal}}Reader } from '../../application/ports/{{name.kebab}}-reader.port.js';
{{/unless}}
import type { {{name.pascal}}Query } from '../../application/queries/{{name.kebab}}/{{name.kebab}}.query.js';
import type { {{name.pascal}}Result } from '../../application/queries/{{name.kebab}}/{{name.kebab}}.result.js';

{{#if style.declared}}
@Repository({{name.pascal}}Reader)
{{/if}}
export class InMemory{{name.pascal}}Reader implements {{name.pascal}}Reader {
  protected readonly answer: {{name.pascal}}Result = {};

  async read(query: {{name.pascal}}Query): Promise<{{name.pascal}}Result> {
    // TODO(domain): replace this canned answer by a real read of the projection, filtered by `query`; a production adapter (SQL view, search index) implements the same port next to this file.
    return this.answer;
  }
}
