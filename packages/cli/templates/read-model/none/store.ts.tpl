import { InMemoryReadModelStore } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { {{name.pascal}}, {{name.camel}}Criteria, type {{name.pascal}}Row } from '{{alias.context}}/application/ports/{{name.kebab}}.port{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import { {{name.camel}}Criteria, type {{name.pascal}}, type {{name.pascal}}Row } from '{{alias.context}}/application/ports/{{name.kebab}}.port{{alias.ext}}';
{{/unless}}

{{#if style.declared}}
@Repository({{name.pascal}})
{{/if}}
export class {{adapter.pascal}} extends InMemoryReadModelStore<{{name.pascal}}Row> implements {{name.pascal}} {
  constructor() {
    super({{name.camel}}Criteria);
  }
}
