import type { JsonDocument } from '../columns/json-document';

/** The table of the process instances as TypeORM returns it. */
export interface ProcessRow {
  /** The empty text outside any tenant. */
  tenantId: string;
  name: string;
  id: string;
  /** JSON; SQL NULL for a `null` state. */
  state: JsonDocument | null;
  version: number;
  ended: boolean;
  timeouts: Record<string, string>;
  updatedAt: Date;
}
