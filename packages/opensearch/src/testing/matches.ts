import { bodiesOf } from './bodies-of';
import { bodyOf } from './body-of';
import { compareAs } from './compare-as';
import type { FakeProperty } from './properties-of';
import { typeAt } from './type-at';
import { UnknownQueryError } from './unknown-query-error';
import { valueAt } from './value-at';

type Source = Readonly<Record<string, unknown>>;
type Clause = Readonly<Record<string, unknown>>;
type Properties = Readonly<Record<string, FakeProperty>>;

/**
 * Whether a document matches a query of the subset of the DSL the store writes: `bool`, `term`,
 * `terms`, `range`, `exists`, `wildcard`, `prefix`, `match_all`. A missing or null value matches
 * no comparison, as in an index.
 */
export function matches(query: Clause, source: Source, properties: Properties): boolean {
  const [kind, body] = Object.entries(query)[0] ?? ['match_all', {}];
  const clause = bodyOf(body);

  if (kind === 'bool') {
    return holdsBool(clause, source, properties);
  }

  if (kind === 'match_all') {
    return true;
  }

  if (kind === 'exists') {
    const value = valueAt(source, String(clause['field']));

    return value !== undefined && value !== null;
  }

  const [path = '', operand] = Object.entries(clause)[0] ?? [];
  const value = valueAt(source, path);

  return value !== undefined && value !== null && compares(kind, operand, value, typeAt(properties, path));
}

function holdsBool(clause: Clause, source: Source, properties: Properties): boolean {
  const list = (name: string): Clause[] => bodiesOf(clause[name]);

  const all = [...list('filter'), ...list('must')].every((inner) => matches(inner, source, properties));
  const none = list('must_not').every((inner) => !matches(inner, source, properties));
  const should = list('should');
  const least = Number(clause['minimum_should_match'] ?? (list('filter').length + list('must').length === 0 ? 1 : 0));
  const some = should.filter((inner) => matches(inner, source, properties)).length >= Math.min(least, should.length);

  return all && none && some;
}

function compares(kind: string, operand: unknown, value: unknown, type: string): boolean {
  const order = (other: unknown): number => compareAs(type, value, other);
  const written = bodyOf(operand);

  switch (kind) {
    case 'term':
      return order(operand) === 0;
    case 'terms':
      return (Array.isArray(operand) ? operand : []).some((candidate) => order(candidate) === 0);
    case 'range':
      return Object.entries(written).every(([bound, limit]) => inRange(bound, order(limit)));
    case 'wildcard':
      return patternOf(String(written['value'])).test(String(value));
    case 'prefix':
      return String(value).startsWith(String(written['value']));
    default:
      throw new UnknownQueryError(`[${kind}] query is not supported by the fake`);
  }
}

function inRange(bound: string, order: number): boolean {
  switch (bound) {
    case 'gt':
      return order > 0;
    case 'gte':
      return order >= 0;
    case 'lt':
      return order < 0;
    default:
      return order <= 0;
  }
}

/** A wildcard pattern: `*` any run, `?` one character, `\` escapes the next one. */
function patternOf(pattern: string): RegExp {
  let source = '';

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index] ?? '';

    if (character === '\\') {
      index += 1;
      source += escapeRegExp(pattern[index] ?? '');
    } else {
      source += character === '*' ? '[\\s\\S]*' : character === '?' ? '[\\s\\S]' : escapeRegExp(character);
    }
  }

  return new RegExp(`^${source}$`, 'u');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
