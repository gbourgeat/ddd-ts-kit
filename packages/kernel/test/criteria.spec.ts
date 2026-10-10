import { describe, expect, it } from 'vitest';
import {
  Criteria,
  CriteriaDefinitionError,
  InvalidCriteriaError,
  UnmappedReadScopeError,
  cursorPage,
  defineCriteria,
  encodeCursor,
  evaluateCriteria,
  offsetPage,
  planCriteria,
  scoped,
  validateCriteria,
  type CriteriaViolation,
} from '../src/index.js';

interface AppointmentRow {
  readonly id: string;
  readonly status: 'booked' | 'cancelled';
  readonly seats: number;
  readonly startsAt: Date;
  readonly room: string | null;
  readonly remote: boolean;
  readonly tenantId: string;
}

const appointments = defineCriteria<AppointmentRow>({
  fields: {
    id: { type: 'string', filter: ['in'] },
    status: { type: 'string', filter: ['eq', 'in', 'contains'], sortable: true },
    seats: { type: 'number', filter: ['eq', 'gte', 'between', 'in'], sortable: true },
    startsAt: { type: 'instant', filter: ['gte'], sortable: true },
    room: { type: 'string', filter: ['isNull', 'eq'], sortable: true, nullable: true },
    tenantId: { type: 'string' },
  },
  defaultSort: [{ field: 'startsAt', direction: 'desc' }],
  tieBreaker: 'id',
  limits: { maxPageSize: 50, maxInList: 3, maxFilters: 4 },
});

const row = (id: string, more: Partial<AppointmentRow> = {}): AppointmentRow => ({
  id,
  status: 'booked',
  seats: 1,
  startsAt: new Date('2026-10-01T08:00:00Z'),
  room: null,
  remote: false,
  tenantId: 'acme',
  ...more,
});

const codes = (violations: readonly CriteriaViolation[]): string[] => violations.map(({ path, code }) => `${path}: ${code}`);
const refused = (criteria: Criteria<AppointmentRow>): string[] => codes(validateCriteria(appointments, criteria));

describe('Criteria', () => {
  it('is built fluently and never changed', () => {
    const base = Criteria.of<AppointmentRow>().where('status', 'eq', 'booked');
    const more = base.where('seats', 'gte', 2).orderBy('startsAt', 'desc').page(offsetPage({ limit: 5 }));

    expect(base.filters).toEqual([{ kind: 'condition', field: 'status', operator: 'eq', value: 'booked' }]);
    expect(base.sort).toEqual([]);
    expect(more.filters).toHaveLength(2);
    expect(more.sort).toEqual([{ field: 'startsAt', direction: 'desc' }]);
    expect(more.pageRequest).toEqual(offsetPage({ limit: 5 }));
  });

  it('writes groups as data', () => {
    const criteria = Criteria.of<AppointmentRow>()
      .or((any) => any.where('status', 'eq', 'cancelled').where('seats', 'gte', 5))
      .not((none) => none.where('room', 'isNull', true));

    expect(criteria.filters.map((node) => node.kind)).toEqual(['or', 'not']);
    expect(criteria.filters[0]).toMatchObject({ filters: [{ field: 'status' }, { field: 'seats' }] });
  });

  it('orders by its own sort first, then by the sort of the page for the fields left', () => {
    const page = offsetPage({ sort: [{ field: 'seats', direction: 'asc' }, { field: 'status', direction: 'desc' }] });
    const criteria = Criteria.of<AppointmentRow>().orderBy('status').page(page);

    expect(criteria.sort).toEqual([{ field: 'status', direction: 'asc' }, { field: 'seats', direction: 'asc' }]);
  });

  it('checks field names, operators and values against the row', () => {
    const criteria = Criteria.of<AppointmentRow>();

    // @ts-expect-error -- not a field of the row
    criteria.where('patient', 'eq', 'x');
    // @ts-expect-error -- contains on a number
    criteria.where('seats', 'contains', '2');
    // @ts-expect-error -- an order on a boolean
    criteria.where('remote', 'gt', true);
    // @ts-expect-error -- a string where the field holds a number
    criteria.where('seats', 'eq', '2');
    // @ts-expect-error -- a value outside the closed vocabulary of the field
    criteria.where('status', 'in', ['booked', 'pending']);
    // @ts-expect-error -- isNull on a field that is never null
    criteria.where('seats', 'isNull', true);
    // @ts-expect-error -- between takes two values
    criteria.where('seats', 'between', [1]);
    // @ts-expect-error -- not a field of the row
    criteria.orderBy('patient');

    expect(criteria.filters).toEqual([]);
  });
});

describe('defineCriteria', () => {
  it('fills in the defaults and freezes the definition', () => {
    expect(appointments.limits).toEqual({ defaultPageSize: 20, maxPageSize: 50, maxInList: 3, maxDepth: 1, maxFilters: 4 });
    expect(appointments.fields['tenantId']).toEqual({ type: 'string', filter: [], sortable: false, nullable: false });
    expect(Object.isFrozen(appointments) && Object.isFrozen(appointments.fields)).toBe(true);
  });

  it('checks the declaration against the row', () => {
    const declare = (): unknown => defineCriteria<AppointmentRow>({
      fields: {
        // @ts-expect-error -- an instant is not a number
        startsAt: { type: 'number' },
        // @ts-expect-error -- a field that may be null says so
        room: { type: 'string' },
        // @ts-expect-error -- contains does not apply to a number
        seats: { type: 'number', filter: ['contains'] },
        id: { type: 'string' },
      },
      tieBreaker: 'id',
    });

    expect(declare).toThrow(CriteriaDefinitionError);
    // @ts-expect-error -- the tie-breaker is a field of the row
    expect(() => defineCriteria<AppointmentRow>({ fields: {}, tieBreaker: 'key' })).toThrow(CriteriaDefinitionError);
  });

  it.each([
    ['a tie-breaker that is not declared', () => defineCriteria<AppointmentRow>({ fields: { seats: { type: 'number' } }, tieBreaker: 'id' })],
    ['a tie-breaker that may be null', () => defineCriteria<AppointmentRow>({ fields: { room: { type: 'string', nullable: true } }, tieBreaker: 'room' })],
    ['a default sort on a field that is not sortable', () => defineCriteria<AppointmentRow>({ fields: { id: { type: 'string' }, seats: { type: 'number' } }, defaultSort: [{ field: 'seats', direction: 'asc' }], tieBreaker: 'id' })],
    ['a default page above the maximum', () => defineCriteria<AppointmentRow>({ fields: { id: { type: 'string' } }, tieBreaker: 'id', limits: { defaultPageSize: 30, maxPageSize: 10 } })],
    ['a limit that is not a positive integer', () => defineCriteria<AppointmentRow>({ fields: { id: { type: 'string' } }, tieBreaker: 'id', limits: { maxInList: 0 } })],
  ])('refuses %s', (_label, declare) => {
    expect(declare).toThrow(CriteriaDefinitionError);
  });
});

describe('defineCriteria and null', () => {
  it('refuses isNull on a field that is never null, at compile time and when the file loads', () => {
    // @ts-expect-error -- isNull on a field that is never null
    const declare = (): unknown => defineCriteria<AppointmentRow>({ fields: { id: { type: 'string', filter: ['isNull'] } }, tieBreaker: 'id' });

    expect(declare).toThrow('declares isNull and is not declared nullable');
  });
});

describe('validateCriteria', () => {
  const criteria = Criteria.of<AppointmentRow>();

  it('accepts what the definition declares', () => {
    const accepted = criteria.where('status', 'in', ['booked']).where('seats', 'between', [1, 3]).orderBy('seats').page(cursorPage({ limit: 50 }));

    expect(refused(accepted)).toEqual([]);
  });

  it.each([
    ['a field that is not declared', criteria.where('remote', 'eq', true), ['filter.remote: unknown_field']],
    ['a field declared without any operator', criteria.where('tenantId', 'eq', 'acme'), ['filter.tenantId: operator_not_allowed']],
    ['an operator the field does not declare', criteria.where('seats', 'lt', 3), ['filter.seats: operator_not_allowed']],
    ['a list longer than the limit', criteria.where('seats', 'in', [1, 2, 3, 4]), ['filter.seats: in_list_too_long']],
    ['an empty list', criteria.where('seats', 'in', []), ['filter.seats: invalid_value']],
    ['a number that is not one', criteria.where('seats', 'eq', Number.NaN), ['filter.seats: invalid_value']],
    ['an instant that is not one', criteria.where('startsAt', 'gte', new Date('never')), ['filter.startsAt: invalid_value']],
    ['an empty text to search', criteria.where('status', 'contains', ''), ['filter.status: invalid_value']],
    ['a group inside a group', criteria.or((any) => any.and((every) => every.where('seats', 'eq', 1))), ['filter: too_deep']],
    ['an empty group', criteria.or((any) => any), ['filter: empty_group']],
    ['more conditions than the limit', criteria.where('seats', 'eq', 1).where('seats', 'eq', 2).where('seats', 'eq', 3).where('seats', 'eq', 4).where('seats', 'eq', 5), ['filter: too_many_filters']],
    ['a sort on a field that is not sortable', criteria.orderBy('tenantId'), ['sort: unsortable_field']],
    ['a page above the maximum', criteria.page(offsetPage({ limit: 51 })), ['page.limit: page_too_large']],
    ['a cursor that is not one', criteria.page(cursorPage({ cursor: 'made-up' })), ['page.cursor: invalid_cursor']],
    ['a cursor of another sort', criteria.orderBy('seats').page(cursorPage({ cursor: encodeCursor({ startsAt: '2026-10-01T08:00:00.000Z', id: 'a1' }) })), ['page.cursor: invalid_cursor']],
    ['a cursor whose values have another type', criteria.page(cursorPage({ cursor: encodeCursor({ startsAt: 12, id: 'a1' }) })), ['page.cursor: invalid_cursor']],
  ])('refuses %s', (_label, asked, expected) => {
    expect(refused(asked)).toEqual(expected);
  });

  it('refuses names written as data, own properties of Object included, and never quotes a value', () => {
    const forged = Criteria.from<AppointmentRow>({
      filters: [
        { kind: 'condition', field: 'constructor', operator: 'eq', value: 'x' },
        { kind: 'condition', field: 'seats', operator: 'eq', value: 'secret-value' },
      ],
      sort: [{ field: '__proto__', direction: 'asc' }],
    });

    const violations = validateCriteria(appointments, forged);

    expect(codes(violations)).toEqual(['filter.constructor: unknown_field', 'filter.seats: invalid_value', 'sort: unsortable_field']);
    expect(JSON.stringify(violations)).not.toContain('secret-value');
  });

  it('lets the tie-breaker be sorted by, declared sortable or not', () => {
    expect(refused(criteria.orderBy('id', 'desc'))).toEqual([]);
  });
});

describe('scoped and planCriteria', () => {
  const rows = [row('a1'), row('a2', { tenantId: 'globex' }), row('a3', { status: 'cancelled' })];
  const mapping = { ids: 'id', filter: { tenantId: 'tenantId' } } as const;
  const all = Criteria.of<AppointmentRow>();
  const ids = (criteria: Parameters<typeof evaluateCriteria<AppointmentRow>>[2]): string[] => evaluateCriteria(appointments, rows, criteria).items.map(({ id }) => id);

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
    const narrowed = scoped(all, { kind: 'filter', filter: { tenantId: 'acme' } }, mapping).refine(() => Criteria.of<AppointmentRow>().where('status', 'eq', 'cancelled'));

    expect(ids(narrowed)).toEqual(['a3']);
  });

  it('throws on a scope the read port cannot express, instead of reading without it', () => {
    expect(() => scoped(all, { kind: 'ids', ids: ['a1'] })).toThrow(UnmappedReadScopeError);
    expect(() => scoped(all, { kind: 'filter', filter: { region: 'eu' } }, mapping)).toThrow(UnmappedReadScopeError);
    expect(() => planCriteria(appointments, scoped(all, { kind: 'filter', filter: { remote: true } }, { filter: { remote: 'remote' } }))).toThrow(UnmappedReadScopeError);
  });

  it('refuses to plan a criteria the definition refuses, naming every violation', () => {
    const asked = all.where('remote', 'eq', true).orderBy('tenantId');

    expect(() => planCriteria(appointments, asked)).toThrow(InvalidCriteriaError);
    expect(() => planCriteria(appointments, asked)).toThrow('filter.remote (unknown_field), sort (unsortable_field)');
  });

  it('plans a total order, the page and one row more for a cursor page', () => {
    const plan = planCriteria(appointments, all.orderBy('seats', 'desc').page(cursorPage({ limit: 10 })));

    expect(plan).toMatchObject({ kind: 'cursor', limit: 10, fetch: 11, offset: 0, empty: false, filter: undefined, seek: undefined });
    expect(plan.sort).toEqual([{ field: 'seats', direction: 'desc' }, { field: 'id', direction: 'desc' }]);
    expect(planCriteria(appointments, all)).toMatchObject({ kind: 'offset', limit: 20, fetch: 20, sort: [{ field: 'startsAt', direction: 'desc' }, { field: 'id', direction: 'desc' }] });
  });

  it('pushes a negation down to the comparisons, keeping the nulls of the fields that may hold one', () => {
    const plan = planCriteria(appointments, all.not((none) => none.where('room', 'eq', 'B').where('seats', 'gte', 2)));

    expect(plan.filter).toEqual({
      kind: 'or',
      parts: [
        { kind: 'or', parts: [{ kind: 'test', field: 'room', operator: 'isNull', value: true, negated: false }, { kind: 'test', field: 'room', operator: 'eq', value: 'B', negated: true }] },
        { kind: 'test', field: 'seats', operator: 'gte', value: 2, negated: true },
      ],
    });
  });
});
