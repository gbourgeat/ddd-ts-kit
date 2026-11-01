import { bodyOf, type Body } from './body-of';

/** A list of JSON objects, one written alone, or none: the clauses of a `bool`, the actions on aliases. */
export function bodiesOf(value: unknown): Body[] {
  return (Array.isArray(value) ? value : value === undefined ? [] : [value]).map(bodyOf);
}
