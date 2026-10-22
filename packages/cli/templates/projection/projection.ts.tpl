import { On, Projection } from '@ddd-ts-kit/kernel/declarations';
import { {{event.definition}}, type {{event.typeName}} } from '{{alias.contexts}}/{{publisher.kebab}}/published-language{{alias.index}}';

// TODO(domain): receive the port of the read model "{{name.words}}" keeps in the constructor, typed by that port (an abstract class of application/ports that extends `ReadModelStore<Row>` of the kernel: `ddd-ts-kit generate port {{context.kebab}} <Name>`); its adapter and its fake are bound to it like any other port.
@Projection('{{context.kebab}}.{{name.kebab}}')
export class {{name.pascal}}Projection {
  @On({{event.definition}})
  async {{event.method}}(event: {{event.typeName}}): Promise<void> {
    // TODO(domain): write what {{event.type}} says into the read model through its port and answer what the store answers, `return this.<port>.upsertIfNewer(<id>, stampOf(event), () => ({ ... }))` with `stampOf` of the kernel: the stamp keeps a replay or a late delivery from undoing a newer line, and the answer is how the application counts what was applied.
  }
}
