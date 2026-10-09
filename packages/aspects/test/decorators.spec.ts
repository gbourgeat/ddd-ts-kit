import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PairNotQuoted, Unreachable } from './support/adapters.js';
import { decoratorOf } from '../src/decorators.js';
import type { DecoratedRateGateway } from './fixtures/decorated-gateway.js';

/*
 * The test runner does not transform standard decorators, and the compiler does. So the
 * fixture is compiled the way a project is built, with the package sources next to it, and
 * the specs run what the compiler emitted.
 */
const FIXTURES = path.join(import.meta.dirname, 'fixtures');
const COMPILED = path.join(FIXTURES, 'dist');
const COMPILER = path.resolve(import.meta.dirname, '../../../node_modules/@typescript/native/bin/tsc');

type Fixture = typeof import('./fixtures/decorated-gateway.js');
type Testing = typeof import('../src/testing.js');

let fixture: Fixture;
let testing: Testing;

beforeAll(async () => {
  execFileSync(process.execPath, [COMPILER, '-p', path.join(FIXTURES, 'tsconfig.json')], { stdio: 'pipe' });
  fixture = await import(/* @vite-ignore */ pathToFileURL(path.join(COMPILED, 'test/fixtures/decorated-gateway.js')).href);
  testing = await import(/* @vite-ignore */ pathToFileURL(path.join(COMPILED, 'src/testing.js')).href);
});

afterAll(() => {
  rmSync(COMPILED, { recursive: true, force: true });
});

function createGateway(): DecoratedRateGateway {
  return new fixture.DecoratedRateGateway();
}

describe('standard decorators on an adapter', () => {
  it('leave the class as it was: same type, private state, undecorated methods', async () => {
    const gateway = createGateway();

    await gateway.reprice(1.2);

    expect(gateway).toBeInstanceOf(fixture.DecoratedRateGateway);
    expect(await testing.withAspectRuntime(testing.createAspectFakes(), () => gateway.rate('EUR-USD'))).toBe(1.2);
  });

  it('nest as they read: logged and timed see one call that retry made twice', async () => {
    const fakes = testing.createAspectFakes();
    const gateway = createGateway().failNext(new Unreachable());

    await testing.withAspectRuntime(fakes, () => gateway.rate('EUR-USD'));

    expect(gateway.calls).toEqual(['rate:EUR-USD', 'rate:EUR-USD']);
    expect(fakes.logger.entries.map((entry) => entry.message)).toEqual([
      'DecoratedRateGateway.rate started',
      'DecoratedRateGateway.rate succeeded',
    ]);
    expect(fakes.metrics.counterValue('rates_total', { class: 'DecoratedRateGateway', outcome: 'success' })).toBe(1);
  });

  it('apply the same policy as the wrappers: a business refusal is not retried', async () => {
    const fakes = testing.createAspectFakes();
    const gateway = createGateway().failNext(new PairNotQuoted());

    await expect(testing.withAspectRuntime(fakes, () => gateway.rate('EUR-USD'))).rejects.toBeInstanceOf(PairNotQuoted);

    expect(gateway.calls).toHaveLength(1);
    expect(fakes.logger.entries.at(-1)).toMatchObject({ level: 'warn', fields: { errorCode: 'PAIR_NOT_QUOTED' } });
  });

  it('resolve the cache from the runtime, with no constructor parameter', async () => {
    const fakes = testing.createAspectFakes();
    const gateway = createGateway();

    await testing.withAspectRuntime(fakes, async () => {
      await gateway.cachedRate('EUR-USD');
      await gateway.cachedRate('EUR-USD');
    });

    expect(gateway.calls).toEqual(['cachedRate:EUR-USD']);
    expect(fakes.cache.size).toBe(1);
  });

  it('keep their state per instance', async () => {
    const fakes = testing.createAspectFakes();
    const broken = createGateway().failNext(new Unreachable(), new Unreachable(), new Unreachable());
    const healthy = createGateway();

    await testing.withAspectRuntime(fakes, async () => {
      await broken.guardedRate('EUR-USD').catch(() => undefined);
      await expect(broken.guardedRate('EUR-USD')).rejects.toMatchObject({ code: 'CIRCUIT_OPEN' });
      await expect(healthy.guardedRate('EUR-USD')).resolves.toBe(1.08);
    });
  });

  it('cancel the underlying call through the signal when the time is up', async () => {
    const fakes = testing.createAspectFakes();
    const gateway = createGateway();

    const outcome = testing.withAspectRuntime(fakes, async () => {
      const slow = gateway.slowRate('EUR-USD');
      await expect(gateway.slowRate('EUR-GBP')).rejects.toMatchObject({ code: 'BULKHEAD_FULL' });
      fakes.scheduler.advance(2000);
      return slow.catch((error: unknown) => error);
    });

    expect(await outcome).toMatchObject({ code: 'TIMEOUT' });
  });
});

describe('decoratorOf', () => {
  const decorate = decoratorOf(() => undefined);
  const contextOf = (overrides: object) =>
    ({ kind: 'method', name: 'find', static: false, private: false, addInitializer: () => undefined, ...overrides }) as never;

  it('refuses a static method, a private method and a symbol name', () => {
    expect(() => decorate(async () => undefined, contextOf({ static: true }))).toThrow(TypeError);
    expect(() => decorate(async () => undefined, contextOf({ private: true }))).toThrow(TypeError);
    expect(() => decorate(async () => undefined, contextOf({ name: Symbol('find') }))).toThrow(TypeError);
    expect(() => decorate(async () => undefined, contextOf({}))).not.toThrow();
  });
});
