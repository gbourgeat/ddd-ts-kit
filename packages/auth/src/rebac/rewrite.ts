export interface SetRewrite {
  readonly kind: 'union' | 'intersection';
  readonly children: readonly Rewrite[];
}

export interface ExclusionRewrite {
  readonly kind: 'exclusion';
  readonly base: Rewrite;
  readonly subtract: Rewrite;
}

/** Tuple to userset: follow `relation` to other objects and ask `permission` there. */
export interface FromRewrite {
  readonly kind: 'from';
  readonly relation: string;
  readonly permission: string;
}

/** A name alone is a computed userset: another relation or permission of the same object. */
export type Rewrite = string | SetRewrite | ExclusionRewrite | FromRewrite;

export function union(...children: readonly Rewrite[]): SetRewrite {
  return { kind: 'union', children };
}

export function intersection(...children: readonly Rewrite[]): SetRewrite {
  return { kind: 'intersection', children };
}

/** Everybody in `base` who is not in `subtract`. */
export function exclusion(base: Rewrite, subtract: Rewrite): ExclusionRewrite {
  return { kind: 'exclusion', base, subtract };
}

/** `from('parent', 'edit')`: whoever may edit the parent. */
export function from(relation: string, permission: string): FromRewrite {
  return { kind: 'from', relation, permission };
}
