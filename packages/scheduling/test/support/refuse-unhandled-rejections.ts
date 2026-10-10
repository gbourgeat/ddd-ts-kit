import { afterAll, expect } from 'vitest';

/** Called at the top of a spec file: a promise the scheduler left without a handler fails the file. */
export function refuseUnhandledRejections(): void {
  const unhandled: unknown[] = [];
  const collect = (reason: unknown): void => void unhandled.push(reason);

  process.on('unhandledRejection', collect);

  afterAll(() => {
    process.off('unhandledRejection', collect);
    expect(unhandled).toEqual([]);
  });
}
