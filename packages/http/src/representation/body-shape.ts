import type { JsonSchema } from '@ddd-ts-kit/validation';

/** What a representation knows of the body it writes or reads: the schema the route declares, and the name of its root. */
export interface BodyShape {
  /** The JSON Schema of the body, with its own `$defs`, as the schema of the route gives it. */
  readonly schema: JsonSchema;
  /** The operation id of the route, or `problem`: the root element of XML, unless the schema names it. */
  readonly name: string;
}
