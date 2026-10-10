import type { TypeDefinition } from './type-definition.js';

export type SchemaDefinition = Readonly<Record<string, TypeDefinition>>;
