export interface StandardSchemaOptions {
  /**
   * Which side of the schema the JSON Schema describes, when the library converts it itself
   * (Standard JSON Schema): `input` (default) for what a client sends, `output` for a response body.
   */
  readonly io?: 'input' | 'output';
}
