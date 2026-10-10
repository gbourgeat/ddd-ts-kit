import type { AuditSortField, PageRequest } from '@ddd-ts-kit/kernel';
import type { SearchOrder } from './search-order.js';

export function orderOf(page: PageRequest<AuditSortField>): SearchOrder {
  const [first] = page.sort;

  return { field: first?.field ?? 'occurredAt', direction: first?.direction ?? 'asc' };
}
