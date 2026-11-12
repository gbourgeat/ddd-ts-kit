import {
  AdvisoryLockOutsideUnitOfWorkError,
  FixedExecutionScope,
  NoCurrentTenantError,
  executionContext,
  type ExecutionScope,
} from '@ddd-ts-kit/kernel';
import type { AdvisoryLockUnderContract } from './advisory-lock/advisory-lock-under-contract';
import type { Awaitable } from './awaitable';
import type { ContractRunner } from './contract-runner';
import { ContractSuite } from './contract-suite';
import { failureOf } from './failure-of';

export interface AdvisoryLockContractOptions {
  readonly name: string;
  /** The helpers over a database nobody holds a lock on; called before each test. */
  createLocks(): Awaitable<AdvisoryLockUnderContract>;
  /**
   * True where two units of work are two connections, so that one can wait for the other: a real
   * server. PGlite is one session, where the second unit of work waits for the connection itself.
   */
  readonly concurrent?: boolean;
}

const KEY = 'invoice-number';

/** How long the holder keeps the lock once the other unit of work has started: far longer than a statement takes. */
const WAIT_MS = 250;

/**
 * What `advisoryLock` and `tryAdvisoryLock` of every ORM package guarantee: a lock held until the
 * unit of work ends and no longer, refused outside of one, apart for each tenant; and, where two
 * transactions can meet, the second one waits for the first, or is told it would.
 */
export function advisoryLockContract(runner: ContractRunner, options: AdvisoryLockContractOptions): void {
  new AdvisoryLockSuite(runner, options).describe(`${options.name} (advisory lock contract)`);
}

class AdvisoryLockSuite extends ContractSuite<AdvisoryLockUnderContract> {
  constructor(
    runner: ContractRunner,
    private readonly options: AdvisoryLockContractOptions,
  ) {
    super(runner, () => options.createLocks());
  }

  protected tests(): void {
    this.holds();
    this.keepsKeysApart();
    this.refuses();
    this.keepsTenantsApart();

    if (this.options.concurrent === true) {
      this.serialises();
      this.tellsWithoutAWait();
    } else {
      this.todo('two units of work on the same key run one after the other (needs two connections)');
    }
  }

  private holds(): void {
    this.it('holds the lock until the unit of work ends, and no longer', async () => {
      const during = await this.subject.run(async () => {
        await this.subject.lock(KEY);

        return this.subject.held();
      });

      this.expect(during).toBe(1);
      this.expect(await this.subject.run(() => this.subject.held())).toBe(0);
    });

    this.it('releases the lock of a unit of work that fails', async () => {
      const failure = await failureOf(() =>
        this.subject.run(async () => {
          await this.subject.lock(KEY);

          throw new Error('the work failed');
        }),
      );

      this.expect(failure instanceof Error).toBe(true);
      this.expect(await this.subject.run(() => this.subject.tryLock(KEY))).toBe(true);
    });
  }

  private keepsKeysApart(): void {
    this.it('takes a key its own unit of work already holds, without a wait, as one lock', async () => {
      const taken = await this.subject.run(async () => {
        await this.subject.lock(KEY);
        await this.subject.lock(KEY);

        return { again: await this.subject.tryLock(KEY), held: await this.subject.held() };
      });

      this.expect(taken).toEqual({ again: true, held: 1 });
    });

    this.it('keeps two keys apart', async () => {
      const held = await this.subject.run(async () => {
        await this.subject.lock(KEY);
        await this.subject.tryLock('credit-note-number');

        return this.subject.held();
      });

      this.expect(held).toBe(2);
    });
  }

  private refuses(): void {
    this.it('refuses outside a unit of work, where the lock would be released at once', async () => {
      const waiting = await failureOf(() => this.subject.lock(KEY));
      const trying = await failureOf(() => this.subject.tryLock(KEY));

      this.expect(waiting instanceof AdvisoryLockOutsideUnitOfWorkError).toBe(true);
      this.expect(trying instanceof AdvisoryLockOutsideUnitOfWorkError).toBe(true);
    });
  }

  private keepsTenantsApart(): void {
    this.it('holds the same key of two tenants as two locks, and of one tenant as one', async () => {
      const held = await this.subject.run(async () => {
        await this.subject.lock(KEY, tenant('acme'));
        await this.subject.lock(KEY, tenant('globex'));
        await this.subject.lock(KEY, tenant('acme'));
        await this.subject.lock(KEY);

        return this.subject.held();
      });

      this.expect(held).toBe(3);
    });

    this.it('refuses a key of tenant data to work that names no tenant', async () => {
      const failure = await failureOf(() => this.subject.run(() => this.subject.lock(KEY, tenant(undefined))));

      this.expect(failure instanceof NoCurrentTenantError).toBe(true);
    });
  }

  private serialises(): void {
    this.it('two units of work on the same key run one after the other', async () => {
      const steps: string[] = [];
      const first = gate();
      const second = gate();

      const holder = this.subject.run(async () => {
        await this.subject.lock(KEY);
        first.open();
        await second.opened;
        await pause(WAIT_MS);
        steps.push('the first ends');
      });

      const waiter = first.opened.then(() =>
        this.subject.run(async () => {
          second.open();
          await this.subject.lock(KEY);
          steps.push('the second holds the lock');
        }),
      );

      await Promise.all([holder, waiter]);

      this.expect(steps).toEqual(['the first ends', 'the second holds the lock']);
    });
  }

  private tellsWithoutAWait(): void {
    this.it('tells, without a wait, that another unit of work holds the key, its tenant and no other', async () => {
      const first = gate();
      const second = gate();

      const holder = this.subject.run(async () => {
        await this.subject.lock(KEY, tenant('acme'));
        first.open();
        await second.opened;
      });

      await first.opened;

      const tried = await this.subject.run(async () => ({
        sameKey: await this.subject.tryLock(KEY, tenant('acme')),
        otherTenant: await this.subject.tryLock(KEY, tenant('globex')),
        otherKey: await this.subject.tryLock('credit-note-number', tenant('acme')),
      }));

      second.open();
      await holder;

      this.expect(tried).toEqual({ sameKey: false, otherTenant: true, otherKey: true });
      this.expect(await this.subject.run(() => this.subject.tryLock(KEY, tenant('acme')))).toBe(true);
    });
  }
}

/** The execution scope of work done for a tenant, or for none. */
function tenant(tenantId: string | undefined): ExecutionScope {
  const actor = {
    id: 'ada',
    type: 'user' as const,
    roles: [],
    attributes: {},
    ...(tenantId === undefined ? {} : { tenantId }),
  };

  return new FixedExecutionScope(executionContext({ correlationId: 'corr-1', actor, origin: 'http' }));
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** A promise that resolves when `open` is called: what orders the steps of two units of work. */
function gate(): { readonly opened: Promise<void>; open(): void } {
  let open: () => void = () => undefined;

  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });

  return { opened, open: () => open() };
}
