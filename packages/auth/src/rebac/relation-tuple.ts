/**
 * One stored fact: `subject` is `relation` of `object`. Written `object#relation@subject` in the
 * Zanzibar paper: `document:1#editor@user:ada`, `document:1#editor@group:eng`.
 */
export interface RelationTuple {
  /** Such as `document:1`: the type, a colon, the id. */
  readonly object: string;
  readonly relation: string;
  /**
   * `<type>:<id>`: a user, or an element such as `group:eng`. The schema says what the element
   * stands for in this relation (`'group#member'`: its members); the tuple never does.
   */
  readonly subject: string;
}
