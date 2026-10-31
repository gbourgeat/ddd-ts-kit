import { describe, expect, it } from 'vitest';
import { Clock, CommandBus, FixedClock, QueryBus } from '@ddd-ts-kit/kernel';
import { defineContextModule, describeToken, kernelModule, tokenIdentity } from '../src';
import { createApplication } from './support/on-container';
import { wiringFailure } from './support/failure';
import { EpochClock } from './support/shop/epoch-clock';

describe('the identity of a port', () => {
  it('is the class for a port of a project: two ports of the same name are two tokens', () => {
    const first = (() => {
      abstract class Mailer {
        abstract send(to: string): Promise<void>;
      }

      return Mailer;
    })();

    const second = (() => {
      abstract class Mailer {
        abstract send(to: string): Promise<void>;
      }

      return Mailer;
    })();

    const module = defineContextModule({
      name: 'mailing',
      register(builder) {
        builder.bind(first).toValue({ send: async () => {} });
        builder.bind(second).toValue({ send: async () => {} });
      },
    });

    const app = createApplication({ modules: [module] });

    expect(describeToken(first)).toBe(describeToken(second));
    expect(tokenIdentity(first)).not.toBe(tokenIdentity(second));
    expect(app.resolve(first)).not.toBe(app.resolve(second));
  });

  it('is the token key for a port that declares one, whatever class carries it', () => {
    const copy = (() => {
      abstract class Clock {
        static readonly tokenKey = 'kernel.Clock';

        abstract now(): Date;
      }

      return Clock;
    })();

    const frozen = new FixedClock(new Date(0));
    const app = createApplication({ modules: [kernelModule({ clock: frozen })] });

    expect(copy).not.toBe(Clock);
    expect(tokenIdentity(copy)).toBe(tokenIdentity(Clock));
    expect(app.resolve(copy)).toBe(frozen);
  });

  it('refuses the port of another copy bound next to the one of this copy: they are one token', () => {
    const copy = (() => {
      abstract class Clock {
        static readonly tokenKey = 'kernel.Clock';

        abstract now(): Date;
      }

      return Clock;
    })();

    const again = defineContextModule({
      name: 'again',
      register: (builder) => void builder.bind(copy).toClass(EpochClock),
    });

    const error = wiringFailure(() => createApplication({ modules: [kernelModule(), again] }));

    expect(error.code).toBe('DUPLICATE_BINDING');
    expect(error.message).toBe('Token "Clock" is bound twice: by module "kernel" and by module "again".');
  });

  it('is not inherited: a class extending a keyed kernel port is another token', () => {
    abstract class BusinessClock extends Clock {
      abstract nextBusinessDay(): Date;
    }
    class ParisBusinessClock implements BusinessClock {
      now(): Date {
        return new Date(0);
      }

      nextBusinessDay(): Date {
        return new Date(86_400_000);
      }
    }

    const calendar = defineContextModule({
      name: 'calendar',
      register: (builder) => void builder.bind(BusinessClock).toClass(ParisBusinessClock),
    });

    const frozen = new FixedClock(new Date('2026-06-01T00:00:00.000Z'));
    const app = createApplication({ modules: [kernelModule({ clock: frozen }), calendar] });

    expect(tokenIdentity(BusinessClock)).not.toBe(tokenIdentity(Clock));
    expect(app.resolve(Clock)).toBe(frozen);
    expect(app.resolve(BusinessClock)).toBeInstanceOf(ParisBusinessClock);
    expect(tokenIdentity(CommandBus)).not.toBe(tokenIdentity(QueryBus));
  });
});
