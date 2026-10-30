export class {{name.pascal}} {
  // TODO(domain): declare the fields of "{{name.words}}" as a client sees them, each with its class-validator decorators and `declare`d without an initial value (shape constraints only). A route uses the class whole (`classSchema({{name.pascal}}, { shared: true })`), nested (`@ValidateNested()` and `@Type`, with `@IsDefined()` when it is required: nested validation lets a missing object through) or in part (`class Body extends pickClass({{name.pascal}}, [...]) {}`, `omitClass`, `partialClass`); the contract documents it once, as {{name.pascal}}.
}
