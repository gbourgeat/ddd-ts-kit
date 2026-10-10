import type { AcquireOptions, Lock, LockHandle } from '@ddd-ts-kit/kernel';

/** A lock that remembers what it was asked, in front of a real one. */
export class ObservedLock implements Lock {
  readonly asked: { key: string; ttlMs: number }[] = [];

  constructor(private readonly lock: Lock) {}

  acquire(key: string, options: AcquireOptions): Promise<LockHandle | undefined> {
    this.asked.push({ key, ttlMs: options.ttlMs });

    return this.lock.acquire(key, options);
  }
}
