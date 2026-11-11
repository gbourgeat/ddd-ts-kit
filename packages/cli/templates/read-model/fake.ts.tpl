import { InMemoryReadModelStore } from '@ddd-ts-kit/kernel';
import { {{name.camel}}Criteria, type {{name.pascal}}, type {{name.pascal}}Row } from '{{alias.context}}/application/ports/{{name.kebab}}.port{{alias.ext}}';

export class Fake{{name.pascal}} extends InMemoryReadModelStore<{{name.pascal}}Row> implements {{name.pascal}} {
  constructor() {
    super({{name.camel}}Criteria);
  }
}
