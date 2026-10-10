import type { Rewrite } from './rewrite.js';

export interface TypeDefinition {
  /** For each relation, who may be its subject: `'user'`, or the userset `'group#member'`. */
  readonly relations?: Readonly<Record<string, readonly string[]>>;
  readonly permissions?: Readonly<Record<string, Rewrite>>;
}
