import {
  AsyncLocalStorageExecutionScope,
  type CriteriaPlan,
  type EventStamp,
  type ReadModelTable,
  type StampedRow,
} from '@ddd-ts-kit/kernel';
import { asTenant } from '@ddd-ts-kit/testing';
import { criteriaContractDefinition, type CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import { OpenSearchReadModelStore, type OpenSearchReadModelOptions } from '../../src';
import { aReadModelName, type SearchNode } from './servers';

type Row = CriteriaContractRow;

export const scope = new AsyncLocalStorageExecutionScope();

/** The three strategies the contracts run under; the tenant of a document is kept apart from the row's own `tenantId`. */
export const STRATEGIES = ['none', 'index', 'attribute'] as const;

export type Strategy = (typeof STRATEGIES)[number];

export interface ReadModelUnderTest {
  readonly store: OpenSearchReadModelStore<Row>;
  readonly name: string;
  /** The indices the read model may have created, for the end of the test. */
  readonly indices: readonly string[];
}

/**
 * A read model of the contract rows on a node, under a strategy, with every write waiting for the
 * refresh, as the contracts read what they just wrote.
 */
export function readModelOf(
  node: SearchNode,
  strategy: Strategy,
  options: Partial<OpenSearchReadModelOptions<Row>> = {},
): ReadModelUnderTest {
  const name = options.name ?? aReadModelName();

  const store = new OpenSearchReadModelStore<Row>({
    transport: node.transport,
    name,
    definition: criteriaContractDefinition,
    tenancy: strategy === 'none' ? { strategy } : { strategy, scope, field: 'owner' },
    refresh: 'wait_for',
    settings: node.settings,
    ...options,
  });

  return { store, name, indices: [`${name}.v1`, `${name}-acme.v1`, `${name}-globex.v1`] };
}

/** Provisions what the strategy needs for `acme` and `globex`. */
export async function provisioned(model: ReadModelUnderTest, strategy: Strategy): Promise<ReadModelUnderTest> {
  if (strategy === 'none') {
    await model.store.ensureMapping();
  } else {
    await model.store.provision('acme');
    await model.store.provision('globex');
  }

  return model;
}

/** The table of a read model, each call made as the work of `acme`: what a contract written without tenants reads. */
export class AsAcme implements ReadModelTable<Row> {
  constructor(private readonly table: ReadModelTable<Row>) {}

  find(key: string): Promise<StampedRow<Row> | undefined> {
    return acme(() => this.table.find(key));
  }

  insert(entry: StampedRow<Row>): Promise<boolean> {
    return acme(() => this.table.insert(entry));
  }

  replace(entry: StampedRow<Row>, held: EventStamp): Promise<boolean> {
    return acme(() => this.table.replace(entry, held));
  }

  search(plan: CriteriaPlan): ReturnType<ReadModelTable<Row>['search']> {
    return acme(() => this.table.search(plan));
  }

  rebuilding(): Promise<boolean> {
    return acme(() => this.table.rebuilding());
  }

  touch(key: string): Promise<void> {
    return this.table.touch(key);
  }

  beginRebuild(): Promise<void> {
    return this.table.beginRebuild();
  }

  shadow(): ReturnType<ReadModelTable<Row>['shadow']> {
    return this.table.shadow();
  }

  touched(limit: number): ReturnType<ReadModelTable<Row>['touched']> {
    return this.table.touched(limit);
  }

  settle(keys: Parameters<ReadModelTable<Row>['settle']>[0]): Promise<void> {
    return this.table.settle(keys);
  }

  holdWriters(): Promise<void> {
    return this.table.holdWriters();
  }

  promote(): Promise<void> {
    return this.table.promote();
  }

  abandonRebuild(): Promise<void> {
    return this.table.abandonRebuild();
  }
}

export function acme<T>(work: () => Promise<T>): Promise<T> {
  return asTenant(scope, 'acme', work);
}
