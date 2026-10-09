import { InvalidPageRequestError, type PageRequest, type SortDirection } from '@ddd-ts-kit/kernel';
import type { AuditEntry } from './entry.js';
import type { AuditFilter, AuditSortField } from './trail.js';

export interface ListOrder {
  readonly field: AuditSortField;
  readonly direction: SortDirection;
}

export function orderOf(page: PageRequest<AuditSortField>): ListOrder {
  const [first] = page.sort;
  return { field: first?.field ?? 'occurredAt', direction: first?.direction ?? 'asc' };
}

/** Where a page ended: enough to resume in either order, whatever the store. */
export interface CursorPosition {
  readonly occurredAt: Date;
  readonly chain: string;
  readonly sequence: number;
}

export function encodeCursor(entry: AuditEntry): string {
  const position = [entry.occurredAt.toISOString(), entry.chain, entry.sequence];
  return Buffer.from(JSON.stringify(position), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorPosition {
  const [occurredAt, chain, sequence] = parsed(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (typeof occurredAt !== 'string' || typeof chain !== 'string' || typeof sequence !== 'number') {
    throw new InvalidPageRequestError('The cursor of a page is not one this list gave');
  }
  return { occurredAt: new Date(occurredAt), chain, sequence };
}

function parsed(text: string): readonly unknown[] {
  try {
    const value: unknown = JSON.parse(text);
    return isList(value) ? value : [];
  } catch {
    return [];
  }
}

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

export function matches(filter: AuditFilter): (entry: AuditEntry) => boolean {
  const tests = [...identityTests(filter), ...resourceTests(filter), ...rangeTests(filter)];
  return (entry) => tests.every((test) => test(entry));
}

type EntryTest = (entry: AuditEntry) => boolean;

function identityTests(filter: AuditFilter): EntryTest[] {
  const expected: readonly (readonly [string | undefined, (entry: AuditEntry) => string | undefined])[] = [
    [filter.chain, (entry) => entry.chain],
    [filter.tenantId, (entry) => entry.tenantId],
    [filter.actorId, (entry) => entry.actor.id],
    [filter.action, (entry) => entry.action],
    [filter.category, (entry) => entry.category],
    [filter.outcome, (entry) => entry.outcome],
    [filter.correlationId, (entry) => entry.correlationId],
  ];
  return expected.flatMap(([value, read]) => (value === undefined ? [] : [(entry: AuditEntry) => read(entry) === value]));
}

function resourceTests({ resource }: AuditFilter): EntryTest[] {
  if (resource === undefined) return [];
  return [(entry) => entry.resource?.type === resource.type && (resource.id === undefined || entry.resource.id === resource.id)];
}

function rangeTests(filter: AuditFilter): EntryTest[] {
  const { from, to, fromSequence, toSequence } = filter;
  return [
    ...(from === undefined ? [] : [(entry: AuditEntry) => entry.occurredAt.getTime() >= from.getTime()]),
    ...(to === undefined ? [] : [(entry: AuditEntry) => entry.occurredAt.getTime() < to.getTime()]),
    ...(fromSequence === undefined ? [] : [(entry: AuditEntry) => entry.sequence >= fromSequence]),
    ...(toSequence === undefined ? [] : [(entry: AuditEntry) => entry.sequence <= toSequence]),
  ];
}

type SortKey = readonly (string | number)[];

export function comparing(order: ListOrder): (left: AuditEntry, right: AuditEntry) => number {
  const sign = order.direction === 'asc' ? 1 : -1;
  return (left, right) => sign * compareKeys(sortKeyOf(left, order.field), sortKeyOf(right, order.field));
}

/** Negative when the position comes before the entry in ascending order. */
export function compareToPosition(entry: AuditEntry, position: CursorPosition, field: AuditSortField): number {
  const at = { occurredAt: position.occurredAt, chain: position.chain, sequence: position.sequence };
  return compareKeys(sortKeyOf(entry, field), sortKeyOf(at, field));
}

function sortKeyOf(entry: CursorPosition, field: AuditSortField): SortKey {
  const inChain = [entry.chain, entry.sequence];
  return field === 'occurredAt' ? [entry.occurredAt.getTime(), ...inChain] : inChain;
}

function compareKeys(left: SortKey, right: SortKey): number {
  for (const [index, value] of left.entries()) {
    const other = right[index];
    if (other === undefined || value === other) continue;
    return value < other ? -1 : 1;
  }
  return 0;
}
