import type { {{name.pascal}}Query, {{name.pascal}}Result } from '../queries/{{name.kebab}}/{{name.kebab}}.query.js';

export interface {{name.pascal}}Reader {
  read(query: {{name.pascal}}Query): Promise<{{name.pascal}}Result>;
}
