export { defineSchema } from './rebac/define-schema.js';
export type { ExpandNode } from './rebac/expand-node.js';
export { InMemoryRelationTupleStore } from './rebac/in-memory-relation-tuple-store.js';
export { InvalidTupleError } from './rebac/invalid-tuple-error.js';
export { objectOf } from './rebac/object-of.js';
export { parseObject } from './rebac/parse-object.js';
export { parseSubject } from './rebac/parse-subject.js';
export type { PermissionMapping } from './rebac/permission-mapping.js';
export { RelationBasedAuthorizer, type RelationBasedAuthorizerOptions } from './rebac/relation-based-authorizer.js';
export type { RelationTuple } from './rebac/relation-tuple.js';
export { RelationTupleStore } from './rebac/relation-tuple-store.js';
export type { Resolution } from './rebac/resolution.js';
export { ReverseExpansionLimitError } from './rebac/reverse-expansion-limit-error.js';
export {
  exclusion,
  from,
  intersection,
  union,
  type ExclusionRewrite,
  type FromRewrite,
  type Rewrite,
  type SetRewrite,
} from './rebac/rewrite.js';
export { Schema } from './rebac/schema.js';
export { SchemaCheckedTupleStore } from './rebac/schema-checked-tuple-store.js';
export type { SchemaDefinition } from './rebac/schema-definition.js';
export { SchemaError } from './rebac/schema-error.js';
export type { SubjectRef } from './rebac/subject-ref.js';
export { tupleKey } from './rebac/tuple-key.js';
export type { TypeDefinition } from './rebac/type-definition.js';
