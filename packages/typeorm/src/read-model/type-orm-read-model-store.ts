import type { ObjectLiteral } from 'typeorm';
import { TableReadModelStore, type CriteriaDefinition } from '@ddd-ts-kit/kernel';
import type { TypeOrmContext } from '../unit-of-work/type-orm-context';
import type { TypeOrmReadModelOptions } from './type-orm-read-model-options';
import { TypeOrmReadModelTable } from './type-orm-read-model-table';

export interface TypeOrmReadModel<Row> extends TypeOrmReadModelOptions<Row> {
  /** What a read of the read model may filter and sort by. */
  readonly definition: CriteriaDefinition<Row>;
}

/**
 * The read model of a projection in a TypeORM entity. The adapter of a read model port
 * extends it and adds nothing: `class TypeOrmAppointmentList extends TypeOrmReadModelStore<AppointmentRow>
 * implements AppointmentList`. Its `table` is what a `ProjectionRebuild` takes.
 */
export class TypeOrmReadModelStore<Row extends ObjectLiteral> extends TableReadModelStore<Row> {
  constructor(context: TypeOrmContext, { definition, ...options }: TypeOrmReadModel<Row>) {
    super(new TypeOrmReadModelTable<Row>(context, options), definition);
  }
}
