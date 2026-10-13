export class {{name.pascal}} {
  // TODO(domain): declare the fields of "{{name.words}}" as a client sees them, each with its class-validator decorators (shape constraints only). A route uses the class whole (`classSchema({{name.pascal}}, { shared: true })`), nested (`@ValidateNested()` and `@Type`) or in part (`class Body extends pickClass({{name.pascal}}, [...]) {}`, `omitClass`, `partialClass`); the contract documents it once, as {{name.pascal}}.
}
