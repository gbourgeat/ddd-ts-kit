export interface {{name.pascal}}Record {
  // TODO(domain): declare the fields received from {{name.title}}, exactly as they arrive (its names, its formats).
}

export interface Translated{{name.pascal}}Record {
  // TODO(domain): replace this type by the value object, command or read model of {{context.kebab}} the record becomes; nothing of the vocabulary of {{name.title}} may appear in it.
}

export class {{name.pascal}}Translator {
  translate(record: {{name.pascal}}Record): Translated{{name.pascal}}Record {
    // TODO(domain): map each field to the model of {{context.kebab}}, convert units and codes, and throw when {{name.title}} sends something this model cannot express.
    return {};
  }
}
