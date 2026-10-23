import type { KeyedRecord } from './keyed-record';

export interface RecordGroup<R extends KeyedRecord> {
  readonly key: string | undefined;
  readonly records: readonly R[];
}
