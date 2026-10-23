import type { Schema } from './schema';

export type Infer<S> = S extends Schema<infer T> ? T : never;
