import { DataSource } from 'typeorm';
import type { TypeOrmContext } from '@ddd-ts-kit/typeorm';
import { entities } from './schema.js';

export type Database = DataSource;
export type DatabaseContext = TypeOrmContext;

export interface ConnectionOptions {
  /** Default 10. A single-session database (the in-process one of the tests) needs 1. */
  readonly poolSize?: number;
}

/** The data source of the application, not yet connected: `initialize()` opens the pool. */
export function createDataSource(url: string, options: ConnectionOptions = {}): Database {
  return new DataSource({ type: 'postgres', url, entities: [...entities], poolSize: options.poolSize ?? 10 });
}
