import { acquiring, type AcquireOptions, type Lock, type LockHandle, type WaitingOptions } from '../application/lock.js';
import type { Clock } from '../application/ports.js';

interface Holder {
  readonly token: number;
  readonly expiresAt: number;
}

/** The lock inside one process, with expiry read from the `Clock`: the fake, and enough for a single instance. */
export class InMemoryLock implements Lock {
  readonly #holders = new Map<string, Holder>();
  readonly #tokens = new Map<string, number>();

  constructor(
    private readonly clock: Clock,
    private readonly waiting: WaitingOptions = {},
  ) {}

  acquire(key: string, options: AcquireOptions): Promise<LockHandle | undefined> {
    return acquiring(async () => this.#attempt(key, options.ttlMs), options.waitMs ?? 0, this.waiting);
  }

  #attempt(key: string, ttlMs: number): LockHandle | undefined {
    const now = this.clock.now().getTime();
    const holder = this.#holders.get(key);
    if (holder !== undefined && holder.expiresAt > now) return undefined;
    const token = (this.#tokens.get(key) ?? 0) + 1;
    this.#tokens.set(key, token);
    this.#holders.set(key, { token, expiresAt: now + ttlMs });
    return { key, fencingToken: token, release: async () => this.#release(key, token) };
  }

  #release(key: string, token: number): void {
    if (this.#holders.get(key)?.token === token) this.#holders.delete(key);
  }
}
