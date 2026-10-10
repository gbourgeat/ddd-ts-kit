import type { AuditSortField, PageRequest } from '@ddd-ts-kit/kernel';
import type { ListOrder } from './list-order.js';

export function orderOf(page: PageRequest<AuditSortField>): ListOrder {
  const [first] = page.sort;

  return { field: first?.field ?? 'occurredAt', direction: first?.direction ?? 'asc' };
}
