import type { CriteriaDefinition } from '../../application/criteria/criteria-definition';
import { pageOfPlan } from '../../application/criteria/page-of-plan';
import { planCriteria } from '../../application/criteria/plan-criteria';
import type { ScopedCriteria } from '../../application/criteria/scoped-criteria';
import type { Page } from '../../application/pagination/page';
import type { ReadModelStore } from '../../application/ports/read-model-store';
import type { ReadModelTable } from '../../application/ports/read-model-table';
import type { EventStamp } from '../../application/read-model/event-stamp';
import type { ReadModelWrite } from '../../application/read-model/read-model-write';
import { writeIfNewer, type StampedChange } from './write-if-newer';

/**
 * A `ReadModelStore` over the table an adapter gives: the same class in memory and on every
 * ORM. A write made while a rebuild runs records its key first, so the rebuild reads that row
 * again from the source before it swaps.
 */
export class TableReadModelStore<Row extends object> implements ReadModelStore<Row> {
  constructor(
    readonly table: ReadModelTable<Row>,
    readonly definition: CriteriaDefinition<Row>,
  ) {}

  async get(key: string): Promise<Row | undefined> {
    return (await this.table.find(key))?.row;
  }

  upsertIfNewer(
    key: string,
    stamp: EventStamp,
    next: (current: Row | undefined) => Row | undefined,
  ): Promise<ReadModelWrite> {
    return this.written({ key, stamp, next });
  }

  delete(key: string, stamp: EventStamp): Promise<ReadModelWrite> {
    return this.written({ key, stamp });
  }

  async search(criteria: ScopedCriteria<Row>): Promise<Page<Row>> {
    const plan = planCriteria(this.definition, criteria);

    if (plan.empty) {
      return pageOfPlan(plan, [], 0);
    }

    const { rows, total } = await this.table.search(plan);

    return pageOfPlan(plan, rows, total);
  }

  private async written(change: StampedChange<Row>): Promise<ReadModelWrite> {
    if (await this.table.rebuilding()) {
      await this.table.touch(change.key);
    }

    return writeIfNewer(this.table, change);
  }
}
