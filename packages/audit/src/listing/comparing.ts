import type { AuditSortField } from '@ddd-ts-kit/kernel';
import type { CursorPosition } from './cursor-position.js';
import type { ListOrder } from './list-order.js';

type SortKey = readonly (string | number)[];

/**
 * The comparison of an order, between two entries or between an entry and the position a
 * cursor names: negative when `left` comes first in that order.
 */
export function comparing(order: ListOrder): (left: CursorPosition, right: CursorPosition) => number {
  const sign = order.direction === 'asc' ? 1 : -1;

  return (left, right) => sign * compareKeys(sortKeyOf(left, order.field), sortKeyOf(right, order.field));
}

function sortKeyOf(position: CursorPosition, field: AuditSortField): SortKey {
  const inChain = [position.chain, position.sequence];

  return field === 'occurredAt' ? [position.occurredAt.getTime(), ...inChain] : inChain;
}

function compareKeys(left: SortKey, right: SortKey): number {
  for (const [index, value] of left.entries()) {
    const other = right[index];

    if (other === undefined || value === other) {
      continue;
    }

    return value < other ? -1 : 1;
  }

  return 0;
}
