import type { CriteriaCase } from './criteria-case';

/** Orders, each total: the tie-breaker follows in the direction of the last field. A null is the greatest value. */
export const SORT_CASES: readonly CriteriaCase[] = [
  {
    name: 'by a number descending, ties by id descending',
    read: (all) => all.orderBy('seats', 'desc'),
    ids: ['a7', 'a2', 'a5', 'a8', 'a6', 'a3', 'a1', 'a4'],
  },
  {
    name: 'by a string ascending: code points, nulls last',
    read: (all) => all.orderBy('room', 'asc'),
    ids: ['a4', 'a1', 'a8', 'a2', 'a6', 'a7', 'a3', 'a5'],
  },
  {
    name: 'by a string descending: nulls first',
    read: (all) => all.orderBy('room', 'desc'),
    ids: ['a5', 'a3', 'a7', 'a6', 'a2', 'a8', 'a1', 'a4'],
  },
  {
    name: 'by a decimal: as numbers',
    read: (all) => all.orderBy('price', 'asc'),
    ids: ['a5', 'a6', 'a2', 'a8', 'a1', 'a4', 'a3', 'a7'],
  },
  {
    name: 'by an instant that may be null',
    read: (all) => all.orderBy('cancelledAt', 'asc'),
    ids: ['a3', 'a6', 'a1', 'a2', 'a4', 'a5', 'a7', 'a8'],
  },
  {
    name: 'by an instant that may be null, descending',
    read: (all) => all.orderBy('cancelledAt', 'desc'),
    ids: ['a8', 'a7', 'a5', 'a4', 'a2', 'a1', 'a6', 'a3'],
  },
  {
    name: 'by a boolean: false first',
    read: (all) => all.orderBy('remote', 'asc'),
    ids: ['a1', 'a4', 'a5', 'a7', 'a2', 'a3', 'a6', 'a8'],
  },
  {
    name: 'by two fields in opposite directions',
    read: (all) => all.orderBy('status', 'asc').orderBy('seats', 'desc'),
    ids: ['a7', 'a8', 'a1', 'a4', 'a6', 'a3', 'a2', 'a5'],
  },
  {
    name: 'the tie-breaker named in the sort keeps its own direction',
    read: (all) => all.orderBy('seats', 'asc').orderBy('id', 'desc'),
    ids: ['a4', 'a8', 'a6', 'a3', 'a1', 'a5', 'a2', 'a7'],
  },
  {
    name: 'a sort with a filter',
    read: (all) => all.where('tenantId', 'eq', 'acme').orderBy('price', 'desc'),
    ids: ['a7', 'a3', 'a1', 'a2', 'a6'],
  },
];
