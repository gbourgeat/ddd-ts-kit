import {
  FixedClock,
  FixedExecutionScope,
  SequentialIdGenerator,
  executionContext,
  type Actor,
  type ExecutionContext,
  type UnitOfWork,
} from '@ddd-ts-kit/kernel';
import type { AuditRecord, AuditTrail } from '../../src/index.js';

export const NOW = new Date('2026-03-01T10:00:00.000Z');

export const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: ['practitioner'], attributes: {} };
export const support: Actor = { id: 'support-7', type: 'user', roles: ['support'], attributes: {} };

export function requestOf(actor: Actor, more: Partial<ExecutionContext> = {}): ExecutionContext {
  return executionContext({ correlationId: 'correlation-1', causationId: 'request-1', actor, origin: 'http', ...more });
}

/** What every source is given: a scope opened on a request of ada, a fixed clock, readable ids. */
export function aSource(context: ExecutionContext = requestOf(ada)) {
  return { scope: new FixedExecutionScope(context), clock: new FixedClock(NOW), ids: new SequentialIdGenerator('audit') };
}

/**
 * The fake of a transactional store: what is written during `run` is staged and only applied
 * when the work succeeds and the commit goes through. Written outside of `run`, it applies at once.
 */
export class StagingUnitOfWork implements UnitOfWork {
  failOnCommit = false;
  #staged: (() => Promise<void>)[] | undefined;

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.#staged !== undefined) return work();
    const staged: (() => Promise<void>)[] = [];
    this.#staged = staged;
    try {
      const result = await work();
      if (this.failOnCommit) throw new Error('The commit was refused by the database');
      this.#staged = undefined;
      for (const apply of staged) await apply();
      return result;
    } finally {
      this.#staged = undefined;
    }
  }

  async write(apply: () => Promise<void>): Promise<void> {
    if (this.#staged === undefined) await apply();
    else this.#staged.push(apply);
  }
}

/** A trail whose writes share the fate of the unit of work in progress, as a SQL store does. */
export class TransactionalAuditTrail implements AuditTrail {
  constructor(
    private readonly unitOfWork: StagingUnitOfWork,
    private readonly committed: AuditTrail,
  ) {}

  record(record: AuditRecord): Promise<void> {
    return this.unitOfWork.write(() => this.committed.record(record));
  }
}
