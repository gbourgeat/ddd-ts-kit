import { describe, expect, it } from 'vitest';
import { Clock, FixedClock, Query } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { contextModule, defineContextModule, fake, kernelModule } from '../src';
import { createApplication, createTestApplication } from './support/on-container';
import { wiringFailure } from './support/failure';
import { InMemoryStock } from './support/shop/in-memory-stock';
import { Stock } from './support/shop/stock.port';

describe('a port', () => {
  it('is bound to a class that implements it, and resolved by the port', () => {
    const module = defineContextModule({
      name: 'shop',
      register: (builder) => void builder.bind(Stock).toClass(InMemoryStock),
    });

    expect(createApplication({ modules: [module] }).resolve(Stock)).toBeInstanceOf(InMemoryStock);
  });
});

describe('the port rule: a port', () => {
  it('is refused when it carries a method with a body: a fake could no longer stand for it', () => {
    abstract class Mailer {
      abstract send(to: string): Promise<void>;

      async sendAll(recipients: readonly string[]): Promise<void> {
        for (const to of recipients) {
          await this.send(to);
        }
      }
    }
    class SmtpMailer implements Mailer {
      async send(): Promise<void> {}

      async sendAll(): Promise<void> {}
    }

    const mailing = defineContextModule({
      name: 'mailing',
      register: (builder) => void builder.bind(Mailer).toClass(SmtpMailer),
    });

    const error = wiringFailure(() => createApplication({ modules: [mailing] }));

    expect(error.code).toBe('INVALID_PORT');

    expect(error.message).toBe(
      'Module "mailing": Mailer implements sendAll: a port is an abstract class with abstract members only, so that a fake or a plain object can stand for it.',
    );
  });

  it('is refused when a port it extends carries a method with a body', () => {
    abstract class Notifier {
      abstract notify(to: string): Promise<void>;

      describe(): string {
        return 'notifier';
      }
    }
    abstract class UrgentNotifier extends Notifier {
      abstract page(to: string): Promise<void>;
    }
    class Pager implements UrgentNotifier {
      async notify(): Promise<void> {}

      async page(): Promise<void> {}

      describe(): string {
        return 'pager';
      }
    }

    const paging = defineContextModule({
      name: 'paging',
      register: (builder) => void builder.bind(UrgentNotifier).toClass(Pager),
    });

    expect(wiringFailure(() => createApplication({ modules: [paging] }))).toMatchObject({
      code: 'INVALID_PORT',
      message: expect.stringContaining('UrgentNotifier implements describe'),
    });
  });

  it('is refused an adapter that extends it: an adapter implements its port', () => {
    class SubclassedStock extends Stock {
      async reserve(): Promise<void> {}

      reserved(): readonly string[] {
        return [];
      }
    }

    const module = defineContextModule({
      name: 'shop',
      register: (builder) => void builder.bind(Stock).toClass(SubclassedStock),
    });

    const error = wiringFailure(() => createApplication({ modules: [module] }));

    expect(error.code).toBe('INVALID_PORT');

    expect(error.message).toBe(
      'Module "shop": SubclassedStock extends Stock: an adapter implements its port, it never extends it.',
    );
  });

  it('takes a rebinding under the same rule', () => {
    class SubclassedClock extends Clock {
      now(): Date {
        return new Date(0);
      }
    }

    const later = defineContextModule({
      name: 'later',
      register: (builder) => void builder.rebind(Clock).toClass(SubclassedClock),
    });

    expect(wiringFailure(() => createApplication({ modules: [kernelModule(), later] })).code).toBe('INVALID_PORT');
  });

  it('may extend another port, and is then another token', () => {
    abstract class Backorders extends Stock {
      abstract cancel(sku: string): Promise<void>;
    }
    class InMemoryBackorders extends InMemoryStock implements Backorders {
      async cancel(): Promise<void> {}
    }

    const module = defineContextModule({
      name: 'shop',
      register(builder) {
        builder.bind(Stock).toClass(InMemoryStock);
        builder.bind(Backorders).toClass(InMemoryBackorders);
      },
    });

    const app = createApplication({ modules: [module] });

    expect(app.resolve(Backorders)).toBeInstanceOf(InMemoryBackorders);
    expect(app.resolve(Stock)).not.toBe(app.resolve(Backorders));
  });
});

describe('a class bound to itself', () => {
  class Settings {
    constructor(readonly clock: Clock) {}

    openingHour(): number {
      return 9;
    }

    isOpen(): boolean {
      return this.clock.now().getUTCHours() >= this.openingHour();
    }
  }

  it('is accepted with its methods: it is no port', () => {
    const module = defineContextModule({
      name: 'shop',
      register(builder) {
        builder.bind(Clock).toValue(new FixedClock(new Date('2026-01-01T10:00:00.000Z')));
        builder.bind(Settings).toClass(Settings, [Clock]);
      },
    });

    const app = createApplication({ modules: [module] });

    expect(app.resolve(Settings)).toBeInstanceOf(Settings);
    expect(app.resolve(Settings).isOpen()).toBe(true);

    expect(app.describe().bindings).toContainEqual(
      expect.objectContaining({ token: 'Settings', implementation: 'Settings', dependencies: ['Clock'] }),
    );
  });
});

describe('a value', () => {
  abstract class Database {
    abstract readonly url: string;

    abstract readonly poolSize: number;
  }

  abstract class ApiKey {
    abstract readonly value: string;
  }

  class Client {
    constructor(
      readonly database: Database,
      readonly key: ApiKey,
    ) {}
  }

  const configuration = defineContextModule({
    name: 'configuration',
    register(builder) {
      builder.bind(Database).toValue({ url: 'postgres://localhost/shop', poolSize: 4 });
      builder.bind(ApiKey).toValue({ value: 'secret' });
      builder.bind(Client).toClass(Client, [Database, ApiKey]);
    },
  });

  it('is typed by an abstract class and bound to a plain object, a primitive included', () => {
    const app = createApplication({ modules: [configuration] });

    expect(app.resolve(Database)).toEqual({ url: 'postgres://localhost/shop', poolSize: 4 });
    expect(app.resolve(ApiKey).value).toBe('secret');
    expect(app.resolve(Client).database).toBe(app.resolve(Database));
    expect(app.resolve(Client).key.value).toBe('secret');
  });

  it('is described as a value, and replaced by a fake like any port', () => {
    const app = createTestApplication({ modules: [configuration], fakes: [fake(ApiKey, { value: 'test-key' })] });

    expect(app.get(Client).key.value).toBe('test-key');

    expect(app.describe().bindings).toContainEqual({
      token: 'ApiKey',
      module: 'configuration',
      lifetime: 'singleton',
      source: 'value',
      dependencies: [],
      overridden: true,
    });
  });
});

describe('a declared class', () => {
  class Ping extends Query<string> {}

  class PingHandler {
    constructor(private readonly clock: Clock) {}

    async execute(): Promise<string> {
      return `pong at ${this.clock.now().toISOString()}`;
    }
  }

  QueryHandler(Ping, [Clock])(PingHandler);

  it('is bound under itself: the application resolves the handler by its class', async () => {
    const app = createTestApplication({ modules: [contextModule('health', [PingHandler])] });

    const handler = app.resolve(PingHandler);

    expect(handler).toBeInstanceOf(PingHandler);
    expect(handler).toBe(app.resolve(PingHandler));
    expect(await handler.execute()).toBe(await app.queryBus.execute(new Ping()));

    expect(app.describe().bindings).toContainEqual(
      expect.objectContaining({ token: 'PingHandler', implementation: 'PingHandler', kind: 'use-case' }),
    );
  });
});
