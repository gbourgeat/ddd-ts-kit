import type { DerivedRelation } from './derived-relation.js';

export interface TypeDefinition {
  /**
   * The stored relations. For each, what may stand at the other end: a type (`'user'`,
   * `'folder'`), or `'group#member'`: a group named there stands for its members.
   */
  readonly relations?: Readonly<Record<string, readonly string[]>>;
  /**
   * The derived relations, computed from the facts. One named after a permission id
   * (`[docsPermissions['document.edit'].id]`) grants that permission on this type.
   */
  readonly derived?: Readonly<Record<string, DerivedRelation>>;
}
