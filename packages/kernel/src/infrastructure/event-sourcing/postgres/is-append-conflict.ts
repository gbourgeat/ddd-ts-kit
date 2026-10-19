import { hasDriverCode } from '../../persistence/has-driver-code.js';

/**
 * What PostgreSQL answers when another transaction appended first: a duplicate (stream, version)
 * (23505); a serialization failure (40001) when the unit of work runs at REPEATABLE READ or
 * SERIALIZABLE and the head of the store moved since it began; a deadlock (40P01) when the same
 * transaction took other row locks in another order than a concurrent one. Each is a conflict the
 * caller retries, never a fault of the store.
 */
const CONFLICTS = new Set(['23505', '40001', '40P01']);

/** Whether an append lost to a concurrent one, whatever wraps the error of the driver. */
export function isAppendConflict(error: unknown): boolean {
  return hasDriverCode(error, CONFLICTS);
}
