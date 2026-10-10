import { type WaitingOptions, acquiring } from '../../application/lock/acquiring.js';
import type { LockHandle } from '../../application/lock/lock-handle.js';
import type { Clock } from '../../application/ports/clock.js';
import type { AcquireOptions, Lock } from '../../application/ports/lock.js';

interface Holder {
  readonly token: number;
  readonly expiresAt: number;
}

/** The lock inside one process, with expiry read from the `Clock`: the fake, and enough for a single instance. */
export class InMemoryLock implements Lock {
  private readonly holders = new Map<string, Holder>();

  private readonly tokens = new Map<string, number>();

  constructor(
    private readonly clock: Clock,
    private readonly waiting: WaitingOptions = {},
  ) {}

  acquire(key: string, options: AcquireOptions): Promise<LockHandle | undefined> {
    return acquiring(async () => this.attempt(key, options.ttlMs), options.waitMs ?? 0, this.waiting);
  }

  private attempt(key: string, ttlMs: number): LockHandle | undefined {
    const now = this.clock.now().getTime();
    const holder = this.holders.get(key);

    if (holder !== undefined && holder.expiresAt > now) return undefined;

    const token = (this.tokens.get(key) ?? 0) + 1;

    this.tokens.set(key, token);
    this.holders.set(key, { token, expiresAt: now + ttlMs });

    return { key, fencingToken: token, release: async () => this.release(key, token) };
  }

  private release(key: string, token: number): void {
    if (this.holders.get(key)?.token === token) this.holders.delete(key);
  }
}
