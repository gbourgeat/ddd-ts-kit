import type { CriteriaCase } from './criteria-case';

/** Conditions joined, alternatives, negations, and what a negation does to a null. */
export const GROUP_CASES: readonly CriteriaCase[] = [
  {
    name: 'two conditions are joined by AND',
    read: (all) => all.where('status', 'eq', 'booked').where('seats', 'gte', 2),
    ids: ['a1', 'a8', 'a7'],
  },
  {
    name: 'or holds when one of its filters does',
    read: (all) => all.or((any) => any.where('status', 'eq', 'cancelled').where('seats', 'gte', 5)),
    ids: ['a3', 'a6', 'a7'],
  },
  {
    name: 'or is joined to the other conditions by AND',
    read: (all) =>
      all.where('remote', 'eq', true).or((any) => any.where('status', 'eq', 'cancelled').where('seats', 'gte', 4)),
    ids: ['a2', 'a3', 'a6'],
  },
  {
    name: 'and inside the criteria changes nothing',
    read: (all) => all.and((every) => every.where('status', 'eq', 'booked').where('remote', 'eq', true)),
    ids: ['a8'],
  },
  {
    name: 'not refuses the rows that hold',
    read: (all) => all.not((none) => none.where('status', 'eq', 'booked')),
    ids: ['a2', 'a3', 'a5', 'a6'],
  },
  {
    name: 'not of two conditions refuses the rows that hold both',
    read: (all) => all.not((none) => none.where('status', 'eq', 'booked').where('remote', 'eq', false)),
    ids: ['a8', 'a2', 'a3', 'a5', 'a6'],
  },
  {
    name: 'not of eq keeps the nulls',
    read: (all) => all.not((none) => none.where('room', 'eq', 'B')),
    ids: ['a2', 'a3', 'a4', 'a5', 'a6', 'a7'],
  },
  {
    name: 'not of ne holds on the equal rows and on the nulls',
    read: (all) => all.not((none) => none.where('room', 'ne', 'B')),
    ids: ['a1', 'a8', 'a3', 'a5'],
  },
  {
    name: 'not of in keeps the nulls',
    read: (all) => all.not((none) => none.where('room', 'in', ['B', 'a'])),
    ids: ['a3', 'a4', 'a5', 'a6', 'a7'],
  },
  {
    name: 'not of contains',
    read: (all) => all.not((none) => none.where('title', 'contains', 'annual')),
    ids: ['a1', 'a3', 'a4', 'a5', 'a6', 'a7'],
  },
  {
    name: 'not of startsWith',
    read: (all) => all.not((none) => none.where('title', 'startsWith', 'Follow')),
    ids: ['a1', 'a8', 'a2', 'a3', 'a6', 'a7'],
  },
  {
    name: 'not of between',
    read: (all) => all.not((none) => none.where('seats', 'between', [2, 3])),
    ids: ['a2', 'a4', 'a7'],
  },
  {
    name: 'not of gt',
    read: (all) => all.not((none) => none.where('seats', 'gt', 2)),
    ids: ['a1', 'a8', 'a3', 'a4', 'a6'],
  },
  {
    name: 'not of gt keeps the nulls',
    read: (all) => all.not((none) => none.where('room', 'gt', 'B')),
    ids: ['a1', 'a8', 'a3', 'a4', 'a5'],
  },
  {
    name: 'not of isNull',
    read: (all) => all.not((none) => none.where('cancelledAt', 'isNull', true)),
    ids: ['a3', 'a6'],
  },
  {
    name: 'groups nest: or of two and',
    read: (all) =>
      all.or((any) =>
        any
          .and((every) => every.where('status', 'eq', 'booked').where('remote', 'eq', true))
          .and((every) => every.where('status', 'eq', 'cancelled').where('seats', 'eq', 2)),
      ),
    ids: ['a8', 'a3', 'a6'],
  },
  {
    name: 'not of or refuses the rows that hold one',
    read: (all) =>
      all.not((none) => none.or((any) => any.where('status', 'eq', 'booked').where('status', 'eq', 'confirmed'))),
    ids: ['a3', 'a6'],
  },
  {
    name: 'not of not holds again, nulls left out as at first',
    read: (all) => all.not((none) => none.not((inner) => inner.where('room', 'eq', 'B'))),
    ids: ['a1', 'a8'],
  },
];
