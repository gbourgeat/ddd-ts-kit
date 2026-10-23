import { Criteria, TableReadModelStore, scoped, type EventStamp } from '@ddd-ts-kit/kernel';
import { ContractSuite } from '../contract-suite';
import { criteriaContractDefinition } from '../criteria/criteria-contract-definition';
import type { CriteriaContractRow } from '../criteria/criteria-contract-row';
import { everything } from './everything';
import type { ReadModelStoreUnderContract } from './read-model-store-under-contract';

type Row = CriteriaContractRow;

/** A suite about a `TableReadModelStore` over the table under contract, closed after each test. */
export abstract class ReadModelStoreSuite extends ContractSuite<ReadModelStoreUnderContract> {
  protected closesAfterEach(): void {
    this.afterEach(async () => {
      await this.subject.close?.();
    });
  }

  protected get store(): TableReadModelStore<Row> {
    return new TableReadModelStore(this.subject.table, criteriaContractDefinition);
  }

  protected put(written: Row, stamp: EventStamp): Promise<string> {
    return this.store.upsertIfNewer(written.id, stamp, () => written);
  }

  protected async ids(): Promise<string[]> {
    const page = await this.store.search(scoped(Criteria.of<Row>().orderBy('id'), everything));

    return page.items.map(({ id }) => id);
  }
}
