import { describe, expect, it } from 'vitest';
import { Clock, CommandBus, IntegrationEventPublisher } from '../src/index.js';
import { describeToken, portDefect, tokenIdentity } from '../src/declarations.js';

describe('tokens', () => {
  abstract class Mailer {
    abstract send(to: string): Promise<void>;
  }

  it('a port class is its own token, named after itself', () => {
    abstract class AnotherMailer {
      abstract send(to: string): Promise<void>;
    }

    expect(describeToken(Mailer)).toBe('Mailer');
    expect(tokenIdentity(Mailer)).toBe(tokenIdentity(Mailer));
    expect(tokenIdentity(AnotherMailer)).not.toBe(tokenIdentity(Mailer));
  });

  it('a port of the kit is the same token in every copy of the kernel a process loads', () => {
    abstract class ClockOfAnotherCopy {
      static readonly tokenKey = 'kernel.Clock';

      abstract now(): Date;
    }

    expect(tokenIdentity(ClockOfAnotherCopy)).toBe(tokenIdentity(Clock));
    expect(tokenIdentity(Clock)).toBe(Symbol.for('@ddd-ts-kit/token/kernel.Clock'));
    expect(tokenIdentity(CommandBus)).not.toBe(tokenIdentity(Clock));
  });

  it('a stable key is declared, never inherited: a class that extends a keyed one is another token', () => {
    abstract class TransactionalPublisher extends IntegrationEventPublisher {}

    expect(tokenIdentity(TransactionalPublisher)).not.toBe(tokenIdentity(IntegrationEventPublisher));
  });

  it('a port may extend a port, and a class bound to itself is no port', () => {
    abstract class BulkMailer extends Mailer {
      abstract sendAll(to: readonly string[]): Promise<void>;
    }
    class Settings {
      describe(): string {
        return 'settings';
      }
    }
    class SmtpMailer implements BulkMailer {
      async send(): Promise<void> {}

      async sendAll(): Promise<void> {}
    }

    expect(portDefect(BulkMailer, SmtpMailer)).toBeUndefined();
    expect(portDefect(Settings, Settings)).toBeUndefined();
  });
});
