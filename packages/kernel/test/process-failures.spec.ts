import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { InMemoryErrorReporter, reportProcessFailures, type ErrorReporter } from '../src/index.js';

describe('reportProcessFailures', () => {
  class FakeProcess extends EventEmitter {
    readonly exits: number[] = [];

    readonly written: string[] = [];

    readonly stderr = { write: (text: string) => this.written.push(text) };

    exit(code: number): void {
      this.exits.push(code);
    }
  }

  it('reports what nothing caught as fatal, writes its stack, flushes, then exits with 1', async () => {
    const target = new FakeProcess();
    const errors = new InMemoryErrorReporter();
    const failure = new TypeError('x is not a function');

    reportProcessFailures(errors, { target, flushTimeoutMs: 50 });
    target.emit('uncaughtException', failure);

    expect(target.exits).toEqual([]);
    await new Promise((resolve) => setImmediate(resolve));

    expect(errors.reports).toEqual([
      { error: failure, report: { origin: 'process', operation: 'uncaughtException', severity: 'fatal' } },
    ]);

    expect(target.written.join('')).toContain('TypeError: x is not a function');
    expect(target.exits).toEqual([1]);
  });

  it('does the same for an unhandled rejection, even when the reporter cannot flush', async () => {
    const target = new FakeProcess();
    const reported: unknown[] = [];

    const broken: ErrorReporter = {
      report: (error) => reported.push(error),
      flush: () => Promise.reject(new Error('tracker down')),
    };

    reportProcessFailures(broken, { target });
    target.emit('unhandledRejection', 'refused');
    await new Promise((resolve) => setImmediate(resolve));

    expect(reported).toEqual(['refused']);
    expect(target.written).toEqual(['Uncaught refused\n']);
    expect(target.exits).toEqual([1]);
  });

  it('removes its listeners when asked', () => {
    const target = new FakeProcess();
    const uninstall = reportProcessFailures(new InMemoryErrorReporter(), { target });

    uninstall();

    expect(target.listenerCount('uncaughtException') + target.listenerCount('unhandledRejection')).toBe(0);
  });
});
