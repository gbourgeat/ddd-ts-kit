import type { CriteriaContractRow } from './criteria-contract-row.js';

type Written = readonly [id: string, status: CriteriaContractRow['status'], title: string, seats: number, price: string];
type Placed = readonly [startsAt: string, cancelledAt: string | null, room: string | null, remote: boolean, tenantId: string];

const ROWS: readonly (readonly [Written, Placed])[] = [
  [['a1', 'booked', 'Annual review', 2, '10.5'], ['2026-10-01T08:00:00.000Z', null, 'B', false, 'acme']],
  [['a2', 'confirmed', 'annual check', 4, '9.5'], ['2026-10-01T09:00:00.000Z', null, 'a', true, 'acme']],
  [['a3', 'cancelled', '100% remote', 2, '100'], ['2026-10-02T08:00:00.000Z', '2026-09-30T10:00:00.000Z', null, true, 'acme']],
  [['a4', 'booked', 'Follow_up', 1, '10.5'], ['2026-10-02T08:00:00.000Z', null, 'A', false, 'globex']],
  [['a5', 'confirmed', 'Follow-up: knee', 3, '-2.25'], ['2026-10-03T12:30:00.500Z', null, null, false, 'globex']],
  [['a6', 'cancelled', "O'Brien \\ intake", 2, '0'], ['2026-10-04T08:00:00.000Z', '2026-10-01T00:00:00.000Z', 'b', true, 'acme']],
  [['a7', 'booked', 'Élan vital', 5, '1000000000000.01'], ['2026-10-05T08:00:00.000Z', null, 'É', false, 'acme']],
  [['a8', 'booked', 'annual, review', 2, '10.49'], ['2026-10-01T08:00:00.000Z', null, 'B', true, 'globex']],
];

/**
 * The eight rows every implementation is loaded with, new objects at each call. They hold
 * ties on every sortable field, nulls, a decimal beyond what a float keeps, an instant with
 * milliseconds, upper and lower case, a non-ASCII letter and the characters a `LIKE` or a
 * careless statement would trip on.
 */
export function criteriaContractRows(): CriteriaContractRow[] {
  return ROWS.map(([[id, status, title, seats, price], [startsAt, cancelledAt, room, remote, tenantId]]) => ({
    id,
    status,
    title,
    seats,
    price,
    startsAt: new Date(startsAt),
    cancelledAt: cancelledAt === null ? null : new Date(cancelledAt),
    room,
    remote,
    tenantId,
  }));
}
