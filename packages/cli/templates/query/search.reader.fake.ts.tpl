import type { {{name.pascal}}Item } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.result.js';
import { InMemory{{name.pascal}}Reader } from '{{alias.context}}/infrastructure/persistence/{{reader.file}}.js';

export class Fake{{name.pascal}}Reader extends InMemory{{name.pascal}}Reader {
  constructor(protected override readonly items: readonly {{name.pascal}}Item[]) {
    super();
  }
}
