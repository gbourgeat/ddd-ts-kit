import { type {{event.typeName}} } from '{{alias.contexts}}/{{publisher.kebab}}/published-language{{alias.index}}';

// TODO(domain): receive the port of the read model "{{name.words}}" keeps in the constructor, typed by that port (`ddd-ts-kit generate read-model {{context.kebab}} <Name> --field <name>:<type>` writes it with its table, its store adapter and its fake), and pass the adapter (or its fake) where the module file of the context builds the projection.
export class {{name.pascal}}Projection {
  async {{event.method}}(event: {{event.typeName}}): Promise<void> {
    // TODO(domain): write what {{event.type}} says into the read model through its port and answer what the store answers, with `stampOf` of the kernel. When the event says the whole line, or may create it, `return this.<port>.upsertIfNewer(<id>, stampOf(event), () => ({ ... }))`; when it changes a line another event created, `return this.<port>.updateIfNewer(<id>, stampOf(event), (line) => ({ ...line, ... }))`, which throws `RowNotHeldError` while that line is not there, so that the event is delivered again after its creation: let the error leave the method. The stamp keeps a replay or a late delivery from undoing a newer line, and the answer is how the application counts what was applied.
  }
}
