import { describe, expect, it } from 'vitest';
import {
  Criteria,
  InvalidCriteriaError,
  UnmappedReadScopeError,
  cursorPage,
  evaluateCriteria,
  planCriteria,
  scoped,
} from '../src/index.js';
import { appointments, row, type AppointmentRow } from './support/appointments.js';

describe('scoped and planCriteria', () => {
  const rows = [row('a1'), row('a2', { tenantId: 'globex' }), row('a3', { status: 'cancelled' })];
  const mapping = { ids: 'id', filter: { tenantId: 'tenantId' } } as const;
  const all = Criteria.of<AppointmentRow>();

  const ids = (criteria: Parameters<typeof evaluateCriteria<AppointmentRow>>[2]): string[] =>
    evaluateCriteria(appointments, rows, criteria).items.map(({ id }) => id);

  it('leaves the criteria alone for a scope of everything', () => {
    expect(scoped(all, { kind: 'all' }).restriction).toEqual({ conditions: [], empty: false });
    expect(ids(scoped(all, { kind: 'all' }))).toEqual(['a3', 'a2', 'a1']);
  });

  it('answers an empty page for a scope of nothing', () => {
    expect(planCriteria(appointments, scoped(all, { kind: 'none' })).empty).toBe(true);
    expect(evaluateCriteria(appointments, rows, scoped(all, { kind: 'none' }))).toEqual({ items: [], total: 0 });
  });

  it('joins ids and filters on the fields the read port maps, whatever the definition lets a caller filter', () => {
    expect(ids(scoped(all, { kind: 'filter', filter: { tenantId: 'acme' } }, mapping))).toEqual(['a3', 'a1']);
    expect(ids(scoped(all, { kind: 'ids', ids: ['a3', 'a2', 'a1', 'a0', 'a9'] }, mapping))).toEqual(['a3', 'a2', 'a1']);
  });

  it('keeps the restriction when the criteria is refined', () => {
    const narrowed = scoped(all, { kind: 'filter', filter: { tenantId: 'acme' } }, mapping).refine(() =>
      Criteria.of<AppointmentRow>().where('status', 'eq', 'cancelled'),
    );

    expect(ids(narrowed)).toEqual(['a3']);
  });

  it('throws on a scope the read port cannot express, instead of reading without it', () => {
    expect(() => scoped(all, { kind: 'ids', ids: ['a1'] })).toThrow(UnmappedReadScopeError);
    expect(() => scoped(all, { kind: 'filter', filter: { region: 'eu' } }, mapping)).toThrow(UnmappedReadScopeError);

    expect(() =>
      planCriteria(
        appointments,
        scoped(all, { kind: 'filter', filter: { remote: true } }, { filter: { remote: 'remote' } }),
      ),
    ).toThrow(UnmappedReadScopeError);
  });

  it('refuses to plan a criteria the definition refuses, naming every violation', () => {
    const asked = all.where('remote', 'eq', true).orderBy('tenantId');

    expect(() => planCriteria(appointments, asked)).toThrow(InvalidCriteriaError);
    expect(() => planCriteria(appointments, asked)).toThrow('filter.remote (unknown_field), sort (unsortable_field)');
  });

  it('plans a total order, the page and one row more for a cursor page', () => {
    const plan = planCriteria(appointments, all.orderBy('seats', 'desc').page(cursorPage({ limit: 10 })));

    expect(plan).toMatchObject({
      kind: 'cursor',
      limit: 10,
      fetch: 11,
      offset: 0,
      empty: false,
      filter: undefined,
      seek: undefined,
    });

    expect(plan.sort).toEqual([
      { field: 'seats', direction: 'desc' },
      { field: 'id', direction: 'desc' },
    ]);

    expect(planCriteria(appointments, all)).toMatchObject({
      kind: 'offset',
      limit: 20,
      fetch: 20,
      sort: [
        { field: 'startsAt', direction: 'desc' },
        { field: 'id', direction: 'desc' },
      ],
    });
  });

  it('pushes a negation down to the comparisons, keeping the nulls of the fields that may hold one', () => {
    const plan = planCriteria(
      appointments,
      all.not((none) => none.where('room', 'eq', 'B').where('seats', 'gte', 2)),
    );

    expect(plan.filter).toEqual({
      kind: 'or',
      parts: [
        {
          kind: 'or',
          parts: [
            { kind: 'test', field: 'room', operator: 'isNull', value: true, negated: false },
            { kind: 'test', field: 'room', operator: 'eq', value: 'B', negated: true },
          ],
        },
        { kind: 'test', field: 'seats', operator: 'gte', value: 2, negated: true },
      ],
    });
  });
});
