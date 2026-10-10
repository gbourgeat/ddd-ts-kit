import type { {{name.pascal}}Query } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.query.js';
import type { {{name.pascal}}Result } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.result.js';

export abstract class {{name.pascal}}Reader {
  abstract read(query: {{name.pascal}}Query): Promise<{{name.pascal}}Result>;
}
