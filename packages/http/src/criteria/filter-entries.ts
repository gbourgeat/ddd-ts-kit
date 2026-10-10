import { isRecord } from '../support/is-record.js';
import type { FilterEntry } from './filter-entry.js';

const FLAT = /^filter((?:\[[^[\]]*\])+)$/;

/**
 * The filter parameters of a query, whichever way the framework hands them: the keys as
 * written (`{ 'filter[status]': 'eq:booked' }`, Express 5 and Fastify by default) or already
 * nested (`{ filter: { status: 'eq:booked' } }`, a `qs` parser). A repeated parameter comes as
 * a list of values.
 */
export function filterEntries(query: Readonly<Record<string, unknown>>): FilterEntry[] {
  const flat = Object.entries(query).flatMap(([key, value]) => {
    const brackets = FLAT.exec(key)?.[1];

    return brackets === undefined ? [] : [{ path: brackets.slice(1, -1).split(']['), values: listed(value) }];
  });

  return query['filter'] === undefined ? flat : [...flat, ...nested(query['filter'], [])];
}

function nested(value: unknown, path: readonly string[]): FilterEntry[] {
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, inner]) => nested(inner, [...path, key]));
  }

  if (Array.isArray(value) && value.some((item) => isRecord(item))) {
    return value.flatMap((item: unknown, index) => nested(item, [...path, String(index)]));
  }

  return [{ path, values: listed(value) }];
}

function listed(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [value];
}
