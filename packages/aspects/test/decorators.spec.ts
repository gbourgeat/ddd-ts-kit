import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { contextModule, createApplication, kernelModule } from '@ddd-ts-kit/di';
import { decoratorOf } from '../src/decorators.js';
import type { DecoratedRateGateway } from './fixtures/decorated-rate-gateway.js';
import { decoratorModes, removeCompiled } from './support/decorator-modes.js';
import { PairNotQuoted } from './support/pair-not-quoted.js';
import { Unreachable } from './support/unreachable.js';

/*
 * The decorators serve the two decorator modes of the compiler. The fixtures are therefore run
 * as the test runner transforms them (their tsconfig sets experimentalDecorators, which the
 * runner follows with no plugin), and as each compiler emits them under each setting, with
 * the package sources next to them.
 */
const FIXTURES = path.join(import.meta.dirname, 'fixtures');

type Fixture = typeof import('./fixtures/decorated-rate-gateway.js');
type Declared = typeof import('./fixtures/pricing/index.js');
type Testing = typeof import('../src/testing.js');

interface Loaded {
  readonly fixture: Fixture;
  readonly declared: Declared;
  readonly testing: Testing;
}

describeDecorators('as the test runner transforms them (experimentalDecorators, no plugin)', async () => ({
  fixture: await import('./fixtures/decorated-rate-gateway.js'),
  declared: await import('./fixtures/pricing/index.js'),
  testing: await import('../src/testing.js'),
}));

for (const mode of decoratorModes(FIXTURES)) {
  describeDecorators(`compiled by ${mode.label}`, async () => ({
    fixture: (await mode.load('test/fixtures/decorated-rate-gateway.js')) as Fixture,
    declared: (await mode.load('test/fixtures/pricing/index.js')) as Declared,
    testing: (await mode.load('src/testing.js')) as Testing,
  }));
}

afterAll(() => {
  removeCompiled(FIXTURES);
});

function describeDecorators(label: string, load: () => Promise<Loaded>): void {
  describeDecoratedAdapter(label, load);
  describeDecoratedResilience(label, load);
  describeDeclaredAdapter(label, load);
}

function describeDecoratedAdapter(label: string, load: () => Promise<Loaded>): void {
  describe(`decorators on an adapter, ${label}`, () => {
    let fixture: Fixture;
    let testing: Testing;

    beforeAll(async () => {
      ({ fixture, testing } = await load());
    }, 60_000);

    function createGateway(): DecoratedRateGateway {
      return new fixture.DecoratedRateGateway();
    }

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

      await expect(testing.withAspectRuntime(fakes, () => gateway.rate('EUR-USD'))).rejects.toBeInstanceOf(
        PairNotQuoted,
      );

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
  });
}

function describeDecoratedResilience(label: string, load: () => Promise<Loaded>): void {
  describe(`stateful decorators on an adapter, ${label}`, () => {
    let fixture: Fixture;
    let testing: Testing;

    beforeAll(async () => {
      ({ fixture, testing } = await load());
    }, 60_000);

    function createGateway(): DecoratedRateGateway {
      return new fixture.DecoratedRateGateway();
    }

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
}

function describeDeclaredAdapter(label: string, load: () => Promise<Loaded>): void {
  describe(`an adapter that declares itself and carries aspects, ${label}`, () => {
    let declared: Declared;

    beforeAll(async () => {
      ({ declared } = await load());
    }, 60_000);

    const application = () =>
      createApplication({
        modules: [kernelModule(), contextModule('pricing', [declared.DeclaredThenMarked, declared.MarkedThenDeclared])],
      });

    it('is bound by its declaration and keeps the policy of its method decorator', async () => {
      const rates = application().resolve(declared.Rates);

      expect(rates).toBeInstanceOf(declared.DeclaredThenMarked);
      expect(await rates.rate('EUR-USD')).toBe(1.08);
      expect(declared.attemptsOf(rates)).toBe(2);
    });

    it('composes with a class decorator of another library, written above or below', async () => {
      const app = application();

      expect(declared.isMarked(declared.DeclaredThenMarked)).toBe(true);
      expect(declared.isMarked(declared.MarkedThenDeclared)).toBe(true);
      expect(await app.resolve(declared.SpotRates).rate('EUR-USD')).toBe(1.08);
      expect(declared.attemptsOf(app.resolve(declared.SpotRates))).toBe(2);
    });

    it('takes the aspects of its declaration around the ones of its methods', async () => {
      const app = application();

      await app.resolve(declared.SpotRates).rate('EUR-USD');

      expect(declared.wrapped).toContain('MarkedThenDeclared as external in pricing');

      expect(app.describe().bindings).toContainEqual(
        expect.objectContaining({ token: 'SpotRates', kind: 'external', origin: 'declared' }),
      );
    });
  });
}

describe('decoratorOf', () => {
  const decorate = decoratorOf(() => undefined);

  const contextOf = (overrides: object) =>
    ({
      kind: 'method',
      name: 'find',
      static: false,
      private: false,
      addInitializer: () => undefined,
      ...overrides,
    }) as never;

  it('refuses a static method, a private method and a symbol name', () => {
    expect(() => decorate(async () => undefined, contextOf({ static: true }))).toThrow(TypeError);
    expect(() => decorate(async () => undefined, contextOf({ private: true }))).toThrow(TypeError);
    expect(() => decorate(async () => undefined, contextOf({ name: Symbol('find') }))).toThrow(TypeError);
    expect(() => decorate(async () => undefined, contextOf({}))).not.toThrow();
  });

  it('refuses, in the legacy call, a static method, a symbol name and what is not a method', () => {
    const descriptor = (): PropertyDescriptor => ({ value: async () => undefined });

    class Gateway {}

    expect(() => decorate(Gateway, 'find', descriptor())).toThrow(TypeError);
    expect(() => decorate(Gateway.prototype, Symbol('find'), descriptor())).toThrow(TypeError);
    expect(() => decorate(Gateway.prototype, 'find', undefined as never)).toThrow(TypeError);
    expect(() => decorate(Gateway.prototype, 'find', descriptor())).not.toThrow();
  });

  it('leaves alone, in the legacy call, a property that holds no method', () => {
    const descriptor: PropertyDescriptor = { value: 42 };

    decorate({}, 'answer', descriptor);

    expect(descriptor.value).toBe(42);
  });
});
