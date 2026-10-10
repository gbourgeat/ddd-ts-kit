import {
  Criteria,
  cursorPage,
  offsetPage,
  scoped,
  type Page,
  type ReadScopeMapping,
  type ScopedCriteria,
} from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable.js';
import type { ContractRunner } from './contract-runner.js';
import { ContractSuite } from './contract-suite.js';
import type { CriteriaCase } from './criteria/criteria-case.js';
import type { CriteriaContractRow } from './criteria/criteria-contract-row.js';
import { criteriaContractRows } from './criteria/criteria-contract-rows.js';
import { GROUP_CASES } from './criteria/group-cases.js';
import { OPERATOR_CASES } from './criteria/operator-cases.js';
import { SCOPE_CASES } from './criteria/scope-cases.js';
import { SORT_CASES } from './criteria/sort-cases.js';

/** What the contract reads through: the `list` of a read port over the rows it was given. */
export interface ReadModelUnderContract {
  list(criteria: ScopedCriteria<CriteriaContractRow>): Promise<Page<CriteriaContractRow>>;
  close?(): Awaitable<void>;
}

export interface CriteriaContractOptions {
  readonly name: string;
  /** A read model holding exactly these rows, read with `criteriaContractDefinition`; called before each test. */
  createReadModel(rows: readonly CriteriaContractRow[]): Awaitable<ReadModelUnderContract>;
}

const MAPPING: ReadScopeMapping<CriteriaContractRow> = {
  ids: 'id',
  filter: { tenantId: 'tenantId', remote: 'remote' },
};

const CASES = [...OPERATOR_CASES, ...GROUP_CASES, ...SORT_CASES, ...SCOPE_CASES];

/**
 * What every translator of criteria guarantees, the in-memory evaluator included: the same
 * criteria answer the same rows in the same order, page by page, on every store.
 */
export function criteriaContract(runner: ContractRunner, options: CriteriaContractOptions): void {
  new CriteriaSuite(runner, options).describe(`${options.name} (criteria contract)`);
}

class CriteriaSuite extends ContractSuite<ReadModelUnderContract> {
  constructor(runner: ContractRunner, options: CriteriaContractOptions) {
    super(runner, () => options.createReadModel(criteriaContractRows()));
  }

  protected tests(): void {
    this.afterEach(async () => {
      await this.subject.close?.();
    });

    for (const example of CASES) {
      this.answers(example);
    }

    this.pagesByOffset();
    this.pagesByCursor();
  }

  private answers(example: CriteriaCase): void {
    this.it(example.name, async () => {
      const page = await this.subject.list(
        read(example).refine((criteria) => criteria.page(offsetPage({ limit: 50 }))),
      );

      this.expect(idsOf(page)).toEqual(example.ids);
      this.expect(page.total).toBe(example.ids.length);
    });
  }

  private pagesByOffset(): void {
    this.it('an offset page holds its slice and the total of the filtered rows', async () => {
      const acme = (offset: number): Promise<Page<CriteriaContractRow>> =>
        this.subject.list(
          scoped(
            Criteria.of<CriteriaContractRow>()
              .where('tenantId', 'eq', 'acme')
              .page(offsetPage({ offset, limit: 2 })),
            { kind: 'all' },
          ),
        );

      this.expect((await acme(0)).items.map(({ id }) => id)).toEqual(['a1', 'a2']);
      this.expect((await acme(2)).items.map(({ id }) => id)).toEqual(['a3', 'a6']);
      this.expect(await acme(4).then(summary)).toEqual({ ids: ['a7'], total: 5, more: false });
      this.expect(await acme(6).then(summary)).toEqual({ ids: [], total: 5, more: false });
    });

    this.it('a read without a page answers the first page of the default size', async () => {
      const page = await this.subject.list(scoped(Criteria.of<CriteriaContractRow>(), { kind: 'all' }));

      this.expect(summary(page)).toEqual({ ids: OPERATOR_CASES[0]?.ids, total: 8, more: false });
    });
  }

  private pagesByCursor(): void {
    for (const example of [...SORT_CASES, ...OPERATOR_CASES.slice(0, 2), ...SCOPE_CASES.slice(0, 2)]) {
      this.it(`walked by cursor, two rows at a time: ${example.name}`, async () => {
        this.expect(await this.walked(example, 2)).toEqual(example.ids);
      });
    }

    this.it('walked by cursor one row at a time, every row comes once, ties and nulls included', async () => {
      for (const example of SORT_CASES) {
        this.expect(await this.walked(example, 1)).toEqual(example.ids);
      }
    });

    this.it('a cursor page carries no total, and no cursor when it is the last', async () => {
      const page = await this.subject.list(
        scoped(Criteria.of<CriteriaContractRow>().page(cursorPage({ limit: 8 })), { kind: 'all' }),
      );

      this.expect(summary(page)).toEqual({ ids: OPERATOR_CASES[0]?.ids, total: undefined, more: false });
    });
  }

  /** Follows `nextCursor` from the first page to the last and answers the ids met, in order. */
  private async walked(example: CriteriaCase, limit: number): Promise<string[]> {
    const ids: string[] = [];
    let cursor: string | undefined;

    do {
      const request = cursorPage({ limit, ...(cursor === undefined ? {} : { cursor }) });
      const page = await this.subject.list(read(example).refine((criteria) => criteria.page(request)));

      ids.push(...idsOf(page));
      cursor = page.nextCursor;
    } while (cursor !== undefined && ids.length <= 2 * CASES.length);

    return ids;
  }
}

function read(example: CriteriaCase): ScopedCriteria<CriteriaContractRow> {
  return scoped(example.read(Criteria.of<CriteriaContractRow>()), example.scope ?? { kind: 'all' }, MAPPING);
}

function idsOf(page: Page<CriteriaContractRow>): string[] {
  return page.items.map(({ id }) => id);
}

function summary(page: Page<CriteriaContractRow>): { ids: string[]; total: number | undefined; more: boolean } {
  return { ids: idsOf(page), total: page.total, more: page.nextCursor !== undefined };
}
