import { TableReadModelStore, type CriteriaDefinition } from '@ddd-ts-kit/kernel';
import type { PrismaRawQueries } from '../outbox/prisma-raw-queries';
import type { PrismaContext } from '../unit-of-work/prisma-context';
import type { PrismaReadModelOptions } from './prisma-read-model-options';
import { PrismaReadModelTable } from './prisma-read-model-table';

export interface PrismaReadModel<Row, Tx> extends PrismaReadModelOptions<Row, Tx> {
  /** What a read of the read model may filter and sort by. */
  readonly definition: CriteriaDefinition<Row>;
}

/**
 * The read model of a projection in a Prisma model. The adapter of a read model port extends
 * it and adds nothing: `class PrismaAppointmentList extends PrismaReadModelStore<AppointmentRow, Prisma.TransactionClient>
 * implements AppointmentList`. Its `table` is what a `ProjectionRebuild` takes.
 */
export class PrismaReadModelStore<Row extends object, Tx extends PrismaRawQueries> extends TableReadModelStore<Row> {
  constructor(context: PrismaContext<Tx>, { definition, ...options }: PrismaReadModel<Row, Tx>) {
    super(new PrismaReadModelTable<Row, Tx>(context, options), definition);
  }
}
