import { advisoryLockKey, type AdvisoryLockOptions } from '@ddd-ts-kit/kernel';
import type { KnexContext } from '../unit-of-work/knex-context';

/**
 * Serialises the units of work that take the same key: waits until no other transaction holds
 * the lock on `key`, then holds it until the unit of work commits or rolls back
 * (`pg_advisory_xact_lock`). For a decision no row can carry a version for: count then insert, the
 * next number of a sequence per tenant. Taken first in the unit of work, before what it protects
 * is read; the same key taken twice in one unit of work is held once.
 *
 * The key is hashed by PostgreSQL (`advisoryLockKey` of the kernel says how, and what a collision
 * costs); with `tenant`, two tenants never wait for each other. Refused outside a unit of work
 * (`AdvisoryLockOutsideUnitOfWorkError`). PostgreSQL only. It is the one way an adapter of a
 * tenant-scoped project takes such a lock (`tenancy/scoped-statement`).
 */
export async function advisoryLock(
  context: KnexContext,
  key: string,
  options: AdvisoryLockOptions = {},
): Promise<void> {
  const text = advisoryLockKey(context, key, options);

  await context.executor().raw('select pg_advisory_xact_lock(hashtextextended(?, 0))', [text]);
}
