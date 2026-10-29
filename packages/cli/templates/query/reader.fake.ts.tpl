import type { {{name.pascal}}Reader } from '{{alias.context}}/application/ports/{{name.kebab}}-reader.port{{alias.ext}}';
import type { {{name.pascal}}Result } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.result{{alias.ext}}';

export class Fake{{name.pascal}}Reader implements {{name.pascal}}Reader {
  constructor(private readonly answer: {{name.pascal}}Result) {}

  async read(): Promise<{{name.pascal}}Result> {
    return this.answer;
  }
}
