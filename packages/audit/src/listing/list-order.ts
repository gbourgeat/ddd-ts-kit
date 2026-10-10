import type { AuditSortField, SortDirection } from '@ddd-ts-kit/kernel';

export interface ListOrder {
  readonly field: AuditSortField;
  readonly direction: SortDirection;
}
