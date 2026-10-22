import type { ExtractTablesWithRelations, TablesRelationalConfig } from 'drizzle-orm';
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { TableReadModelStore, type CriteriaDefinition } from '@ddd-ts-kit/kernel';
import type { DrizzleContext } from '../unit-of-work/drizzle-context';
import type { DrizzleReadModelOptions } from './drizzle-read-model-options';
import { DrizzleReadModelTable } from './drizzle-read-model-table';

export interface DrizzleReadModel<Row> extends DrizzleReadModelOptions<Row> {
  /** What a read of the read model may filter and sort by. */
  readonly definition: CriteriaDefinition<Row>;
}

/**
 * The read model of a projection in a drizzle table. The adapter of a read model port extends
 * it and adds nothing: `class DrizzleAppointmentList extends DrizzleReadModelStore<AppointmentRow, NodePgQueryResultHKT>
 * implements AppointmentList`. Its `table` is what a `ProjectionRebuild` takes.
 */
export class DrizzleReadModelStore<
  Row extends object,
  Q extends PgQueryResultHKT,
  F extends Record<string, unknown> = Record<string, never>,
  S extends TablesRelationalConfig = ExtractTablesWithRelations<F>,
> extends TableReadModelStore<Row> {
  constructor(context: DrizzleContext<Q, F, S>, { definition, ...options }: DrizzleReadModel<Row>) {
    super(new DrizzleReadModelTable<Row, Q, F, S>(context, options), definition);
  }
}
