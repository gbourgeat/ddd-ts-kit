import { pgSchema, type PgSchema } from 'drizzle-orm/pg-core';
import { schemaNameOf } from '@ddd-ts-kit/kernel';

/** One PostgreSQL schema per bounded context: its tables are declared with `.table(...)`. */
export function contextSchema(context: string): PgSchema<string> {
  return pgSchema(schemaNameOf(context));
}
