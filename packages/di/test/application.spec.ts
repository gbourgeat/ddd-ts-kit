import { describe, expect, it } from 'vitest';
import { Clock } from '@ddd-ts-kit/kernel';
import { createApplication, defineContextModule, tokenIdentity, type BindingInfo, type ContextModule } from '../src';
import { EpochClock } from './support/shop/epoch-clock';
import { InMemoryStock } from './support/shop/in-memory-stock';
import { platform } from './support/shop/platform.module';
import { ReserveStock } from './support/shop/reserve-stock';
import { shop } from './support/shop/shop.module';
import { Stock } from './support/shop/stock.port';

describe('createApplication', () => {
  it('resolves a class with its constructor arguments taken from the listed ports, in order', async () => {
    const app = createApplication({ modules: [platform, shop] });

    const handler = app.resolve(ReserveStock);

    expect(handler).toBeInstanceOf(ReserveStock);
    expect(handler.stock).toBe(app.resolve(Stock));
    await expect(handler.execute('book')).resolves.toBe('book@0');
    expect(app.resolve(Stock).reserved()).toEqual(['book']);
  });

  it('does not depend on the order of the modules', () => {
    const app = createApplication({ modules: [shop, platform] });

    expect(app.resolve(ReserveStock).clock).toBeInstanceOf(EpochClock);
  });

  it('shares a singleton by default and builds a transient on every resolution', () => {
    abstract class Backorders extends Stock {}

    const backorders = defineContextModule({
      name: 'backorders',
      register: (builder) => {
        builder.bind(Backorders).toClass(InMemoryStock).transient();
      },
    });

    const app = createApplication({ modules: [shop, platform, backorders] });

    expect(app.resolve(Stock)).toBe(app.resolve(Stock));
    expect(app.resolve(Backorders)).not.toBe(app.resolve(Backorders));
  });

  it('binds factories and values', () => {
    abstract class Greeting {
      abstract readonly text: string;
    }
    abstract class Banner {
      abstract readonly text: string;
    }
    let built = 0;

    const ui = defineContextModule({
      name: 'ui',
      register(builder) {
        builder.bind(Greeting).toValue({ text: 'hello' });

        builder.bind(Banner).toFactory((resolve) => {
          built += 1;

          return { text: `${resolve(Greeting).text}!` };
        });
      },
    });

    const app = createApplication({ modules: [ui] });

    expect(app.resolve(Banner)).toEqual({ text: 'hello!' });
    expect(app.resolve(Banner)).toBe(app.resolve(Banner));
    expect(built).toBe(1);
  });

  it('builds a transient factory every time', () => {
    abstract class Ticket {
      abstract readonly number: number;
    }
    let next = 0;

    const counter = defineContextModule({
      name: 'counter',
      register: (builder) => {
        builder
          .bind(Ticket)
          .toFactory(() => ({ number: (next += 1) }))
          .transient();
      },
    });

    const app = createApplication({ modules: [counter] });

    expect([app.resolve(Ticket).number, app.resolve(Ticket).number]).toEqual([1, 2]);
  });

  it('isolates two applications built from the same modules', () => {
    const first = createApplication({ modules: [platform, shop] });
    const second = createApplication({ modules: [platform, shop] });

    expect(first.resolve(Stock)).not.toBe(second.resolve(Stock));
    expect(first.container).not.toBe(second.container);
  });

  it('exposes the tsyringe container, where a port is registered under its identity and never under its class', () => {
    const app = createApplication({ modules: [platform, shop] });

    expect(app.container.isRegistered(tokenIdentity(Clock))).toBe(true);
    expect(app.container.resolve<Clock>(tokenIdentity(Clock))).toBe(app.resolve(Clock));
    expect(app.container.resolve<Stock>(tokenIdentity(Stock))).toBe(app.resolve(Stock));
    expect(app.container.isRegistered(ReserveStock)).toBe(false);
  });
});

describe('decorate hook', () => {
  it('receives every created instance once, with port, context and declared kind', () => {
    const seen: BindingInfo[] = [];

    const app = createApplication({
      modules: [platform, shop],
      decorate: (instance, info) => {
        seen.push(info);

        return instance;
      },
    });

    app.resolve(ReserveStock);
    app.resolve(ReserveStock);

    expect(seen).toEqual([
      { token: Stock, context: 'shop', kind: 'repository' },
      { token: Clock, context: 'platform' },
      { token: ReserveStock, context: 'shop', kind: 'use-case' },
    ]);
  });

  it('hands out what the hook returns, to resolvers and to dependents alike', () => {
    const stamped = new WeakSet<object>();

    const app = createApplication({
      modules: [platform, shop],
      decorate: (instance, info) => {
        if (info.kind === 'repository' && typeof instance === 'object' && instance !== null) {
          stamped.add(instance);
        }

        return instance;
      },
    });

    expect(stamped.has(app.resolve(ReserveStock).stock)).toBe(true);
    expect(stamped.has(app.resolve(ReserveStock))).toBe(false);
  });

  it('runs for each instance of a transient binding and for values', () => {
    abstract class Settings {
      abstract readonly id: number;
    }
    abstract class Stopwatch extends Clock {}
    let calls = 0;

    const misc = defineContextModule({
      name: 'misc',
      register(builder) {
        builder.bind(Settings).toValue({ id: 1 }).as('external');
        builder.bind(Stopwatch).toClass(EpochClock).transient();
      },
    });

    const app = createApplication({
      modules: [misc],
      decorate: (instance) => {
        calls += 1;

        return instance;
      },
    });

    app.resolve(Settings);
    app.resolve(Settings);
    app.resolve(Stopwatch);
    app.resolve(Stopwatch);

    expect(calls).toBe(3);
  });
});

describe('lifecycle', () => {
  const recording = (name: string, log: string[]): ContextModule =>
    defineContextModule({
      name,
      register: () => {},
      onStart: async () => void log.push(`start ${name}`),
      onStop: async () => void log.push(`stop ${name}`),
    });

  it('starts modules in order and stops them in reverse order', async () => {
    const log: string[] = [];
    const app = createApplication({ modules: [recording('a', log), recording('b', log), platform] });

    await app.start();
    await app.stop();

    expect(log).toEqual(['start a', 'start b', 'stop b', 'stop a']);
  });

  it('gives the hooks a resolver', async () => {
    let now: Date | undefined;

    const reading = defineContextModule({
      name: 'reading',
      register: () => {},
      onStart: ({ resolve }) => {
        now = resolve(Clock).now();
      },
    });

    const app = createApplication({ modules: [platform, reading] });

    await app.start();

    expect(now).toEqual(new Date(0));
  });

  it('stops only what was started, once, and keeps stopping after a failure', async () => {
    const log: string[] = [];

    const failing = defineContextModule({
      name: 'failing',
      register: () => {},
      onStop: () => {
        throw new Error('cannot close');
      },
    });

    const app = createApplication({ modules: [recording('a', log), failing] });

    await app.stop();
    expect(log).toEqual([]);

    await app.start();
    await app.start();
    await expect(app.stop()).rejects.toThrow(AggregateError);
    await app.stop();

    expect(log).toEqual(['start a', 'stop a']);
  });
});
