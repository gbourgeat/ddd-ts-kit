import { type {{event.typeName}} } from '{{alias.contexts}}/{{publisher.kebab}}/published-language{{alias.index}}';

// TODO(domain): receive the port of the read model "{{name.words}}" keeps in the constructor, typed by that port (`ddd-ts-kit generate read-model {{context.kebab}} <Name> --field <name>:<type>` writes it with its table, its store adapter and its fake), and pass the adapter (or its fake) where the module file of the context builds the projection.
export class {{name.pascal}}Projection {
  async {{event.method}}(event: {{event.typeName}}): Promise<void> {
    // TODO(domain): write what {{event.type}} says into the read model through its port and answer what the store answers, `return this.<port>.upsertIfNewer(<id>, stampOf(event), () => ({ ... }))` with `stampOf` of the kernel when the event says the whole line (right in any order of delivery), or `this.<port>.updateIfNewer(<id>, stampOf(event), (line) => ({ ...line, ... }))` when it changes part of a line another event created, which answers `'missing'` when that line is not there. The stamp keeps a replay or a late delivery from undoing a newer line, and the answer is how the application counts what was applied.
  }
}
