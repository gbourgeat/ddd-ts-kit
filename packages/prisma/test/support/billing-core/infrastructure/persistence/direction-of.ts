import type { PageRequest, SortDirection } from '@ddd-ts-kit/kernel';
import type { InvoiceSort } from '../../application/ports/invoice-queries.port.js';

export function directionOf(request: PageRequest<InvoiceSort>): SortDirection {
  return request.sort[0]?.direction ?? 'asc';
}
