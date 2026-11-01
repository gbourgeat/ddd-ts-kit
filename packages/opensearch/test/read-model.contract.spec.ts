import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criteriaContract, readModelRowsContract } from '../src/testing';
import { AsAcme, STRATEGIES, acme, provisioned, readModelOf } from './support/read-models';
import { NODES, type SearchNode } from './support/servers';

const runner = { describe, it, expect, beforeEach, afterEach };

describe.each(NODES)('OpenSearchReadModelStore, %s', (_, start) => {
  let node: SearchNode;

  beforeAll(async () => {
    node = await start();
  });

  afterAll(async () => {
    await node.stop();
  });

  describe.each(STRATEGIES)('tenancy %s', (strategy) => {
    readModelRowsContract(runner, {
      name: `OpenSearchReadModelStore, ${strategy}`,
      async createTable() {
        const model = await provisioned(readModelOf(node, strategy), strategy);

        return {
          table: strategy === 'none' ? model.store.table : new AsAcme(model.store.table),
          close: () => node.drop(model.indices),
        };
      },
    });

    criteriaContract(runner, {
      name: `OpenSearchReadModelStore, ${strategy}`,
      async createReadModel(rows) {
        const model = await provisioned(readModelOf(node, strategy), strategy);

        for (const row of rows) {
          await acme(() => model.store.upsertIfNewer(row.id, { eventId: 'evt-1', occurredAt: new Date(0) }, () => row));
        }

        return {
          search: (criteria) => acme(() => model.store.search(criteria)),
          close: () => node.drop(model.indices),
        };
      },
    });
  });
});
