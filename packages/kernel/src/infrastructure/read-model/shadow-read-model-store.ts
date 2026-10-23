import type { ScopedCriteria } from '../../application/criteria/scoped-criteria';
import type { Page } from '../../application/pagination/page';
import type { ReadModelRows } from '../../application/ports/read-model-rows';
import type { ReadModelStore } from '../../application/ports/read-model-store';
import type { EventStamp } from '../../application/read-model/event-stamp';
import type { ReadModelWrite } from '../../application/read-model/read-model-write';
import { writeIfNewer } from './write-if-newer';

/**
 * The copy a rebuild fills, as the store of a projection: the same writes as the live store,
 * "apply if newer" included, on the rows `ReadModelTable.shadow()` gives. A projection writes, it
 * does not search: `search` is refused.
 */
export class ShadowReadModelStore<Row> implements ReadModelStore<Row> {
  constructor(private readonly rows: ReadModelRows<Row>) {}

  async get(key: string): Promise<Row | undefined> {
    return (await this.rows.find(key))?.row;
  }

  upsertIfNewer(
    key: string,
    stamp: EventStamp,
    next: (current: Row | undefined) => Row | undefined,
  ): Promise<ReadModelWrite> {
    return writeIfNewer(this.rows, { key, stamp, next });
  }

  delete(key: string, stamp: EventStamp): Promise<ReadModelWrite> {
    return writeIfNewer(this.rows, { key, stamp });
  }

  search(criteria: ScopedCriteria<Row>): Promise<Page<Row>> {
    return Promise.reject(new TypeError('The copy of a read model being rebuilt is written, never searched'));
  }
}
