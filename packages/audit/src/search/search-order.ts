import type { AuditSortField, SortDirection } from '@ddd-ts-kit/kernel';

export interface SearchOrder {
  readonly field: AuditSortField;
  readonly direction: SortDirection;
}
