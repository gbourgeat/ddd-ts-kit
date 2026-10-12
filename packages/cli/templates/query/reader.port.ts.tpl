import type { {{name.pascal}}Query } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.query{{alias.ext}}';
import type { {{name.pascal}}Result } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.result{{alias.ext}}';

export abstract class {{name.pascal}}Reader {
  abstract read(query: {{name.pascal}}Query): Promise<{{name.pascal}}Result>;
}
