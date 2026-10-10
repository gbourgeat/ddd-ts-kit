import type { ImportRecord } from './import-record.js';

/** The statement a module specifier belongs to. */
export interface FoundStatement {
  readonly record: Omit<ImportRecord, 'specifier' | 'line'>;
  /** Offset of the statement keyword in the blanked source. */
  readonly offset: number;
}
