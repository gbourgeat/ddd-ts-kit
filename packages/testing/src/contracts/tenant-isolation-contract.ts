import {
  AsyncLocalStorageExecutionScope,
  NoCurrentTenantError,
  executionContext,
  systemActor,
} from '@ddd-ts-kit/kernel';
import type { AggregateRoot, ExecutionContext, ExecutionScope, Repository, TenantElevation } from '@ddd-ts-kit/kernel';
import { asTenant } from '../execution/as-tenant.js';
import type { Awaitable } from './awaitable.js';
import type { ContractRunner } from './contract-runner.js';
import { ContractSuite } from './contract-suite.js';
import { failureOf } from './failure-of.js';

export interface TenantIsolationContractOptions<A extends AggregateRoot<Id>, Id extends string | number> {
  /** The strategy and the adapter: `KnexInvoiceRepository, shared tables`. */
  readonly name: string;
  /**
   * The repository, on empty storage where both tenants `acme` and `globex` exist (their
   * schema or database provisioned), reading the tenant from `scope`; called before each test.
   */
  createRepository(scope: ExecutionScope): Awaitable<Repository<A, Id>>;
  /** A new valid aggregate with an id of its own at each call. */
  createAggregate(): A;
  /** Any business operation that changes what `stateOf` returns. */
  mutate(aggregate: A): void;
  idOf(aggregate: A): Id;
  stateOf(aggregate: A): unknown;
  /**
   * A new aggregate, never saved, with the id of `aggregate`: what a tenant would insert under
   * an id another tenant already holds. Without it, that case is not run.
   */
  recreate?(aggregate: A): A;
  /**
   * Whether an elevation of platform staff over every tenant reads another tenant's aggregate:
   * true on shared tables (and under row-level security), false where a unit of work reaches one
   * tenant's storage only (schema or database per tenant). Writes are refused either way.
   */
  readonly elevatedReads?: boolean;
}

const ACME = 'acme';
const GLOBEX = 'globex';
const STAFF = 'initech';

/**
 * What every strategy of tenant isolation guarantees, for one repository: no read and no write
 * crosses from one tenant to another (an update, an insert under a taken id, a write under an
 * elevation), an elevation widens reads only, and work that names no tenant reaches nothing. Run it
 * against each adapter and each strategy a project uses.
 */
export function tenantIsolationContract<A extends AggregateRoot<Id>, Id extends string | number = string>(
  runner: ContractRunner,
  options: TenantIsolationContractOptions<A, Id>,
): void {
  new TenantIsolationSuite(runner, options).describe(`${options.name} (tenant isolation contract)`);
}

class TenantIsolationSuite<A extends AggregateRoot<Id>, Id extends string | number> extends ContractSuite<
  Repository<A, Id>
> {
  private static readonly scope = new AsyncLocalStorageExecutionScope();

  constructor(
    runner: ContractRunner,
    private readonly options: TenantIsolationContractOptions<A, Id>,
  ) {
    super(runner, () => options.createRepository(TenantIsolationSuite.scope));
  }

  protected tests(): void {
    this.hidesWhatAnotherTenantSaved();
    this.keepsAnotherTenantFromOverwriting();
    this.keepsAnotherTenantFromInserting();
    this.widensReadsOnlyUnderAnElevation();
    this.refusesWorkWithoutATenant();
  }

  private hidesWhatAnotherTenantSaved(): void {
    const { options } = this;

    this.it('hides from a tenant what another tenant saved, and keeps it for its owner', async () => {
      const saved = options.createAggregate();

      await this.as(ACME, () => this.subject.save(saved));

      this.expect(await this.as(GLOBEX, () => this.subject.findById(options.idOf(saved)))).toBe(undefined);

      const found = await this.as(ACME, () => this.subject.findById(options.idOf(saved)));

      this.expect(found === undefined ? undefined : options.stateOf(found)).toEqual(options.stateOf(saved));
    });
  }

  private keepsAnotherTenantFromOverwriting(): void {
    const { options } = this;

    this.it('leaves untouched what a tenant saved when another saves under the same id', async () => {
      const saved = options.createAggregate();
      const original = options.stateOf(saved);

      await this.as(ACME, () => this.subject.save(saved));

      const intruder = await this.as(ACME, () => this.subject.findById(options.idOf(saved)));

      if (intruder !== undefined) {
        options.mutate(intruder);
        await failureOf(() => this.as(GLOBEX, () => this.subject.save(intruder)));
      }

      const kept = await this.as(ACME, () => this.subject.findById(options.idOf(saved)));

      this.expect(kept === undefined ? undefined : options.stateOf(kept)).toEqual(original);
    });
  }

  private keepsAnotherTenantFromInserting(): void {
    const { options } = this;
    const recreate = options.recreate?.bind(options);

    if (recreate === undefined) {
      return;
    }

    this.it('leaves untouched what a tenant saved when another inserts a new aggregate under its id', async () => {
      const saved = options.createAggregate();
      const original = options.stateOf(saved);

      await this.as(ACME, () => this.subject.save(saved));

      const clash = recreate(saved);

      options.mutate(clash);
      await failureOf(() => this.as(GLOBEX, () => this.subject.save(clash)));

      const kept = await this.as(ACME, () => this.subject.findById(options.idOf(saved)));

      this.expect(kept === undefined ? undefined : options.stateOf(kept)).toEqual(original);
    });
  }

  private widensReadsOnlyUnderAnElevation(): void {
    const { options } = this;

    this.it('lets an elevation read what it reaches when the strategy allows it, and write nothing', async () => {
      const saved = options.createAggregate();
      const original = options.stateOf(saved);
      const elevation: TenantElevation = { reason: 'CONTRACT', tenants: 'all' };
      const staff: ExecutionContext = Object.freeze({ ...this.contextOf(STAFF), elevation });

      await this.as(ACME, () => this.subject.save(saved));

      if (options.elevatedReads === true) {
        const seen = await TenantIsolationSuite.scope.run(staff, () => this.subject.findById(options.idOf(saved)));

        this.expect(seen === undefined ? undefined : options.stateOf(seen)).toEqual(original);
      }

      const changed = await this.as(ACME, () => this.subject.findById(options.idOf(saved)));

      if (changed !== undefined) {
        options.mutate(changed);
        await failureOf(() => TenantIsolationSuite.scope.run(staff, () => this.subject.save(changed)));
      }

      const kept = await this.as(ACME, () => this.subject.findById(options.idOf(saved)));

      this.expect(kept === undefined ? undefined : options.stateOf(kept)).toEqual(original);
    });
  }

  private refusesWorkWithoutATenant(): void {
    const { options } = this;

    this.it('refuses a write of work that names no tenant, and shows it nothing', async () => {
      const saved = options.createAggregate();

      await this.as(ACME, () => this.subject.save(saved));

      const job = executionContext({ correlationId: 'no-tenant', actor: systemActor('contract'), origin: 'test' });
      const scope = TenantIsolationSuite.scope;

      const read = await Promise.resolve()
        .then(() => scope.run(job, () => this.subject.findById(options.idOf(saved))))
        .catch((error: unknown) => error);

      const write = await failureOf(() => scope.run(job, () => this.subject.save(options.createAggregate())));

      // Refused by the adapter, or, under row-level security alone, shown nothing by the database.
      this.expect(read instanceof NoCurrentTenantError || read === undefined).toBe(true);
      this.expect(write instanceof NoCurrentTenantError).toBe(true);
    });
  }

  private contextOf(tenantId: string): ExecutionContext {
    return executionContext({ correlationId: 'contract', actor: systemActor('contract'), origin: 'test', tenantId });
  }

  private as<T>(tenantId: string, work: () => Promise<T>): Promise<T> {
    return asTenant(TenantIsolationSuite.scope, tenantId, work);
  }
}
