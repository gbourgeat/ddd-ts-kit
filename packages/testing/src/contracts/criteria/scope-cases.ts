import type { CriteriaCase } from './criteria-case';

const HOSTILE = "'; drop table criteria_contract; --";

/** What the actor may read, joined by AND whatever the criteria says, and values nobody should trust. */
export const SCOPE_CASES: readonly CriteriaCase[] = [
  {
    name: 'a scope of everything adds nothing',
    read: (all) => all.where('status', 'eq', 'cancelled'),
    scope: { kind: 'all' },
    ids: ['a3', 'a6'],
  },
  { name: 'a scope of nothing answers nothing', read: (all) => all, scope: { kind: 'none' }, ids: [] },
  {
    name: 'a scope of ids keeps those rows only',
    read: (all) => all,
    scope: { kind: 'ids', ids: ['a7', 'a2', 'unknown'] },
    ids: ['a2', 'a7'],
  },
  { name: 'a scope of no id answers nothing', read: (all) => all, scope: { kind: 'ids', ids: [] }, ids: [] },
  {
    name: 'a scope of ids is joined to the filters',
    read: (all) => all.where('status', 'eq', 'booked'),
    scope: { kind: 'ids', ids: ['a1', 'a2', 'a4'] },
    ids: ['a1', 'a4'],
  },
  {
    name: 'a scope by filter keeps the rows of the tenant',
    read: (all) => all,
    scope: { kind: 'filter', filter: { tenantId: 'acme' } },
    ids: ['a1', 'a2', 'a3', 'a6', 'a7'],
  },
  {
    name: 'a scope by filter is joined to the filters',
    read: (all) => all.where('status', 'eq', 'booked'),
    scope: { kind: 'filter', filter: { tenantId: 'acme' } },
    ids: ['a1', 'a7'],
  },
  {
    name: 'an or of the caller never widens the scope',
    read: (all) => all.or((any) => any.where('tenantId', 'eq', 'globex').where('status', 'eq', 'booked')),
    scope: { kind: 'filter', filter: { tenantId: 'acme' } },
    ids: ['a1', 'a7'],
  },
  {
    name: 'a not of the caller never widens the scope',
    read: (all) => all.not((none) => none.where('tenantId', 'eq', 'acme')),
    scope: { kind: 'filter', filter: { tenantId: 'acme' } },
    ids: [],
  },
  {
    name: 'a scope by filter on a boolean',
    read: (all) => all,
    scope: { kind: 'filter', filter: { tenantId: 'globex', remote: false } },
    ids: ['a4', 'a5'],
  },
  { name: 'a hostile value in eq is a value', read: (all) => all.where('title', 'eq', HOSTILE), ids: [] },
  {
    name: 'a hostile value in contains is a value',
    read: (all) => all.where('title', 'contains', "%' or '1'='1"),
    ids: [],
  },
  {
    name: 'a hostile value in a list is a value',
    read: (all) => all.where('title', 'in', [HOSTILE, 'Follow_up', '$1', '?']),
    ids: ['a4'],
  },
  {
    name: 'a hostile value in a scope is a value',
    read: (all) => all,
    scope: { kind: 'ids', ids: [HOSTILE, 'a1" or "1"="1', 'a5'] },
    ids: ['a5'],
  },
  { name: 'the table is still there', read: (all) => all.where('seats', 'gte', 5), ids: ['a7'] },
];
