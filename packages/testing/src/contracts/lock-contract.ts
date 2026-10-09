import type { Lock, LockHandle } from '@ddd-ts-kit/kernel';
import { ContractSuite, type Awaitable, type ContractRunner } from './suite.js';

export interface LockContractOptions {
  readonly name: string;
  /** A lock nobody holds; called before each test. */
  createLock(): Awaitable<Lock>;
  /** Makes the time of the lock pass: advances its clock, or really waits. */
  elapse(ms: number): Awaitable<void>;
}

/** What every adapter of the kernel `Lock` port guarantees, the in-memory one included. */
export function lockContract(runner: ContractRunner, options: LockContractOptions): void {
  new LockSuite(runner, options).describe(`${options.name} (lock contract)`);
}

const HELD = { ttlMs: 30_000 };

class LockSuite extends ContractSuite<Lock> {
  readonly #elapse: (ms: number) => Awaitable<void>;

  constructor(runner: ContractRunner, options: LockContractOptions) {
    super(runner, () => options.createLock());
    this.#elapse = (ms) => options.elapse(ms);
  }

  protected tests(): void {
    this.excludes();
    this.frees();
    this.fences();
    this.waits();
  }

  private excludes(): void {
    this.it('gives a free key to the first who asks, and to nobody else meanwhile', async () => {
      const first = await this.subject.acquire('report:2026-03', HELD);

      this.expect(first?.key).toBe('report:2026-03');
      this.expect(await this.subject.acquire('report:2026-03', HELD)).toBe(undefined);
    });

    this.it('keeps keys apart', async () => {
      await this.subject.acquire('report:2026-03', HELD);

      this.expect((await this.subject.acquire('report:2026-04', HELD)) !== undefined).toBe(true);
    });

    this.it('gives the key to exactly one of several who ask at the same time', async () => {
      const handles = await Promise.all(Array.from({ length: 8 }, () => this.subject.acquire('report:2026-03', HELD)));

      this.expect(handles.filter((handle) => handle !== undefined).length).toBe(1);
    });
  }

  private frees(): void {
    this.it('frees the key when its holder releases it, once or twice', async () => {
      const first = await this.held('report:2026-03');

      await first.release();
      await first.release();

      this.expect((await this.subject.acquire('report:2026-03', HELD)) !== undefined).toBe(true);
    });

    this.it('frees the key by itself when the time to live has passed', async () => {
      await this.subject.acquire('report:2026-03', { ttlMs: 300 });
      this.expect(await this.subject.acquire('report:2026-03', HELD)).toBe(undefined);

      await this.#elapse(400);

      this.expect((await this.subject.acquire('report:2026-03', HELD)) !== undefined).toBe(true);
    });

    this.it('ignores the release of a holder whose lock expired and was taken by another', async () => {
      const late = await this.subject.acquire('report:2026-03', { ttlMs: 300 });
      await this.#elapse(400);
      await this.subject.acquire('report:2026-03', HELD);

      await late?.release();

      this.expect(await this.subject.acquire('report:2026-03', HELD)).toBe(undefined);
    });
  }

  private fences(): void {
    this.it('numbers the acquisitions of a key with a token that only grows', async () => {
      const tokens: number[] = [];
      for (let turn = 0; turn < 3; turn += 1) {
        const handle = await this.held('report:2026-03');
        tokens.push(handle.fencingToken);
        await handle.release();
      }

      this.expect(tokens.every((token, index) => index === 0 || token > (tokens[index - 1] ?? token))).toBe(true);
      this.expect(new Set(tokens).size).toBe(3);
    });
  }

  private waits(): void {
    this.it('waits for a key that is released within the time it was told to wait', async () => {
      const first = await this.held('report:2026-03');

      const [, second] = await Promise.all([first.release(), this.subject.acquire('report:2026-03', { ...HELD, waitMs: 2_000 })]);

      this.expect(second !== undefined).toBe(true);
      this.expect((second?.fencingToken ?? 0) > first.fencingToken).toBe(true);
    });

    this.it('gives up once it has waited that long for a key that stays held', async () => {
      await this.subject.acquire('report:2026-03', HELD);

      this.expect(await this.subject.acquire('report:2026-03', { ...HELD, waitMs: 120 })).toBe(undefined);
    });
  }

  private async held(key: string): Promise<LockHandle> {
    const handle = await this.subject.acquire(key, HELD);
    if (handle === undefined) throw new Error(`The lock ${key} was expected to be free`);
    return handle;
  }
}
