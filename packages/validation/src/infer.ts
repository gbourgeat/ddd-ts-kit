import type { Schema } from './schema.js';

export type Infer<S> = S extends Schema<infer T> ? T : never;
