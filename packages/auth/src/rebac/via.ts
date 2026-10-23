/**
 * `via('parent', 'edit')`: whoever holds `edit` on each element the relation `parent` leads to.
 * OpenFGA writes it `edit from parent`.
 */
export interface Via {
  readonly via: string;
  readonly holds: string;
}

/**
 * One way of holding a derived relation: a relation or a derived relation of the same element,
 * by its name, or one of a related element, with `via`.
 */
export type Way = string | Via;

export function via(relation: string, holds: string): Via {
  return { via: relation, holds };
}
