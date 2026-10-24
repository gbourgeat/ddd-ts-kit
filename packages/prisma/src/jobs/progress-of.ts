import type { JobProgress } from '@ddd-ts-kit/kernel';

/** The progress a worker reported, or nothing when the column holds none. */
export function progressOf(value: unknown): { progress?: JobProgress } {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const done: unknown = Reflect.get(value, 'done');
  const total: unknown = Reflect.get(value, 'total');

  if (typeof done !== 'number') {
    throw new TypeError('The progress of a background job is not written the way the store writes it.');
  }

  return { progress: typeof total === 'number' ? { done, total } : { done } };
}
