/**
 * One fact: `subject` has `relation` to `object`. Written `object#relation@subject` in the
 * Zanzibar paper: `document:1#editor@user:ada`, `document:1#editor@group:eng#member`.
 */
export interface RelationTuple {
  /** Such as `document:1`: the type, a colon, the id. */
  readonly object: string;
  readonly relation: string;
  /** `<type>:<id>`, or the userset `<type>:<id>#<relation>`: everybody having that relation. */
  readonly subject: string;
}
