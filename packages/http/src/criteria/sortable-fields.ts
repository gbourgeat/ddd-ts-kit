import type { CriteriaDefinition } from '@ddd-ts-kit/kernel';

/** The fields a client may sort by: those declared sortable, and the tie-breaker. */
export function sortableFields<Row>(definition: CriteriaDefinition<Row>): string[] {
  const declared = Object.entries(definition.fields).flatMap(([field, { sortable }]) => (sortable ? [field] : []));

  return [...new Set([...declared, definition.tieBreaker])];
}
