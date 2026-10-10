import { DataSource } from 'typeorm';
import { entities } from '{{alias.platform}}/database/schema.js';

export interface ConnectionOptions {
  /** Default 10. A single-session database (the in-process one of the tests) needs 1. */
  readonly poolSize?: number;
}

/** The data source of the application, not yet connected: `initialize()` opens the pool. */
export function createDataSource(url: string, options: ConnectionOptions = {}): DataSource {
  return new DataSource({ type: 'postgres', url, entities: [...entities], poolSize: options.poolSize ?? 10 });
}
