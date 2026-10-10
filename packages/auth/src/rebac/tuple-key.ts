import type { RelationTuple } from './relation-tuple.js';

export function tupleKey(tuple: RelationTuple): string {
  return `${tuple.object}#${tuple.relation}@${tuple.subject}`;
}
