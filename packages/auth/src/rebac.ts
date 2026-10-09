export {
  RelationBasedAuthorizer,
  ReverseExpansionLimitError,
  type PermissionMapping,
  type RelationBasedAuthorizerOptions,
} from './rebac/authorizer.js';
export type { ExpandNode } from './rebac/evaluation.js';
export {
  Schema,
  SchemaError,
  defineSchema,
  exclusion,
  from,
  intersection,
  union,
  type ExclusionRewrite,
  type FromRewrite,
  type Resolution,
  type Rewrite,
  type SchemaDefinition,
  type SetRewrite,
  type TypeDefinition,
} from './rebac/schema.js';
export {
  InMemoryRelationTupleStore,
  SchemaCheckedTupleStore,
  type RelationTupleStore,
} from './rebac/store.js';
export {
  InvalidTupleError,
  objectOf,
  parseObject,
  parseSubject,
  tupleKey,
  type RelationTuple,
  type SubjectRef,
} from './rebac/tuples.js';
