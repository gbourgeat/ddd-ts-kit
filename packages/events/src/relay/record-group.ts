import type { KeyedRecord } from './keyed-record.js';

export interface RecordGroup<R extends KeyedRecord> {
  readonly key: string | undefined;
  readonly records: readonly R[];
}
