import type { TypeDefinition } from './type-definition';

export type SchemaDefinition = Readonly<Record<string, TypeDefinition>>;
