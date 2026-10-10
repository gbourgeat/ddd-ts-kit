import type { StandardSchemaV1 } from './standard-schema-v1.js';

export type InferStandardOutput<S extends StandardSchemaV1> = NonNullable<
  S['~standard']['types']
>['output'];
