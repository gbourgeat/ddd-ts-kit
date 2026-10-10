import type { CriteriaCase } from './criteria-case.js';

/** Every operator on every type it applies to. The default sort is `startsAt`, then `id`. */
export const OPERATOR_CASES: readonly CriteriaCase[] = [
  {
    name: 'no filter: every row, in the default sort ended by the tie-breaker',
    read: (all) => all,
    ids: ['a1', 'a8', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'],
  },
  { name: 'eq on a string', read: (all) => all.where('status', 'eq', 'booked'), ids: ['a1', 'a8', 'a4', 'a7'] },
  { name: 'ne on a string', read: (all) => all.where('status', 'ne', 'booked'), ids: ['a2', 'a3', 'a5', 'a6'] },
  {
    name: 'in on a string',
    read: (all) => all.where('status', 'in', ['confirmed', 'cancelled']),
    ids: ['a2', 'a3', 'a5', 'a6'],
  },
  { name: 'gt on a number', read: (all) => all.where('seats', 'gt', 2), ids: ['a2', 'a5', 'a7'] },
  { name: 'gte on a number', read: (all) => all.where('seats', 'gte', 4), ids: ['a2', 'a7'] },
  { name: 'lt on a number', read: (all) => all.where('seats', 'lt', 2), ids: ['a4'] },
  { name: 'lte on a number', read: (all) => all.where('seats', 'lte', 2), ids: ['a1', 'a8', 'a3', 'a4', 'a6'] },
  {
    name: 'between on a number holds both bounds',
    read: (all) => all.where('seats', 'between', [2, 3]),
    ids: ['a1', 'a8', 'a3', 'a5', 'a6'],
  },
  { name: 'in on a number', read: (all) => all.where('seats', 'in', [1, 5]), ids: ['a4', 'a7'] },
  {
    name: 'eq on a decimal compares numbers: 10.50 is 10.5',
    read: (all) => all.where('price', 'eq', '10.50'),
    ids: ['a1', 'a4'],
  },
  {
    name: 'gt on a decimal is not a comparison of strings',
    read: (all) => all.where('price', 'gt', '10.49'),
    ids: ['a1', 'a3', 'a4', 'a7'],
  },
  { name: 'lt on a decimal reads the sign', read: (all) => all.where('price', 'lt', '0'), ids: ['a5'] },
  {
    name: 'between on a decimal',
    read: (all) => all.where('price', 'between', ['9.5', '10.5']),
    ids: ['a1', 'a8', 'a2', 'a4'],
  },
  {
    name: 'in on a decimal ignores trailing zeros',
    read: (all) => all.where('price', 'in', ['100.0', '0.00']),
    ids: ['a3', 'a6'],
  },
  {
    name: 'a decimal keeps the digits a float would lose',
    read: (all) => all.where('price', 'gt', '1000000000000.009'),
    ids: ['a7'],
  },
  {
    name: 'gte on an instant',
    read: (all) => all.where('startsAt', 'gte', at('2026-10-02T08:00:00Z')),
    ids: ['a3', 'a4', 'a5', 'a6', 'a7'],
  },
  {
    name: 'eq on an instant, to the millisecond',
    read: (all) => all.where('startsAt', 'eq', at('2026-10-03T12:30:00.500Z')),
    ids: ['a5'],
  },
  {
    name: 'eq on an instant written in another zone',
    read: (all) => all.where('startsAt', 'eq', at('2026-10-01T11:00:00+02:00')),
    ids: ['a2'],
  },
  {
    name: 'lt on an instant',
    read: (all) => all.where('startsAt', 'lt', at('2026-10-01T09:00:00Z')),
    ids: ['a1', 'a8'],
  },
  {
    name: 'between on an instant',
    read: (all) => all.where('startsAt', 'between', [at('2026-10-01T09:00:00Z'), at('2026-10-03T12:30:00.500Z')]),
    ids: ['a2', 'a3', 'a4', 'a5'],
  },
  {
    name: 'in on an instant',
    read: (all) => all.where('startsAt', 'in', [at('2026-10-05T08:00:00Z'), at('2026-10-04T08:00:00Z')]),
    ids: ['a6', 'a7'],
  },
  { name: 'eq on a boolean', read: (all) => all.where('remote', 'eq', true), ids: ['a8', 'a2', 'a3', 'a6'] },
  { name: 'ne on a boolean', read: (all) => all.where('remote', 'ne', true), ids: ['a1', 'a4', 'a5', 'a7'] },
  { name: 'contains is case sensitive', read: (all) => all.where('title', 'contains', 'annual'), ids: ['a8', 'a2'] },
  { name: 'contains takes % as a character', read: (all) => all.where('title', 'contains', '%'), ids: ['a3'] },
  { name: 'contains takes _ as a character', read: (all) => all.where('title', 'contains', '_'), ids: ['a4'] },
  {
    name: 'contains takes a backslash as a character',
    read: (all) => all.where('title', 'contains', '\\'),
    ids: ['a6'],
  },
  { name: 'contains takes a quote as a character', read: (all) => all.where('title', 'contains', "'B"), ids: ['a6'] },
  { name: 'contains finds a non-ASCII letter', read: (all) => all.where('title', 'contains', 'É'), ids: ['a7'] },
  { name: 'startsWith', read: (all) => all.where('title', 'startsWith', 'Follow'), ids: ['a4', 'a5'] },
  { name: 'startsWith is case sensitive', read: (all) => all.where('title', 'startsWith', 'follow'), ids: [] },
  { name: 'startsWith takes % as a character', read: (all) => all.where('title', 'startsWith', '100%'), ids: ['a3'] },
  {
    name: 'isNull true',
    read: (all) => all.where('cancelledAt', 'isNull', true),
    ids: ['a1', 'a8', 'a2', 'a4', 'a5', 'a7'],
  },
  { name: 'isNull false', read: (all) => all.where('cancelledAt', 'isNull', false), ids: ['a3', 'a6'] },
  { name: 'eq never holds on a null', read: (all) => all.where('room', 'eq', 'B'), ids: ['a1', 'a8'] },
  {
    name: 'ne never holds on a null either',
    read: (all) => all.where('room', 'ne', 'B'),
    ids: ['a2', 'a4', 'a6', 'a7'],
  },
  {
    name: 'gt on a string follows code points: upper case before lower case',
    read: (all) => all.where('room', 'gt', 'B'),
    ids: ['a2', 'a6', 'a7'],
  },
  {
    name: 'gte on an instant that may be null leaves the nulls out',
    read: (all) => all.where('cancelledAt', 'gte', at('2026-10-01T00:00:00Z')),
    ids: ['a6'],
  },
];

function at(instant: string): Date {
  return new Date(instant);
}
