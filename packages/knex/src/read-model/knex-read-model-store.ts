import { TableReadModelStore, type CriteriaDefinition } from '@ddd-ts-kit/kernel';
import type { KnexContext } from '../unit-of-work/knex-context';
import type { KnexReadModelOptions } from './knex-read-model-options';
import { KnexReadModelTable } from './knex-read-model-table';

export interface KnexReadModel<Row> extends KnexReadModelOptions<Row> {
  /** What a read of the read model may filter and sort by. */
  readonly definition: CriteriaDefinition<Row>;
}

/**
 * The read model of a projection in a knex table. The adapter of a read model port extends
 * it and adds nothing: `class KnexAppointmentList extends KnexReadModelStore<AppointmentRow>
 * implements AppointmentList`. Its `table` is what a `ProjectionRebuild` takes.
 */
export class KnexReadModelStore<Row extends object> extends TableReadModelStore<Row> {
  constructor(context: KnexContext, { definition, ...options }: KnexReadModel<Row>) {
    super(new KnexReadModelTable<Row>(context, options), definition);
  }
}
