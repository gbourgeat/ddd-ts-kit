import type { {{name.pascal}}Result } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.result{{alias.ext}}';
import { InMemory{{name.pascal}}Reader } from '{{alias.context}}/infrastructure/persistence/{{reader.file}}{{alias.ext}}';

export class Fake{{name.pascal}}Reader extends InMemory{{name.pascal}}Reader {
  constructor(protected override readonly answer: {{name.pascal}}Result) {
    super();
  }
}
