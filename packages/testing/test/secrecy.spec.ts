import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { expectNoSecret } from '../src';

const PASSWORD = 'correct-horse-battery-staple';

class LeakingAdapter {
  private readonly options: { readonly credentials: { readonly user: string; readonly password: string } };

  constructor(password: string) {
    this.options = { credentials: { user: 'app', password } };
  }

  describe(): string {
    return this.options.credentials.user;
  }
}

class SafeAdapter {
  private readonly connect: () => string;

  constructor(password: string) {
    this.connect = () => `amqps://app:${password}@broker`;
  }

  open(): string {
    return this.connect();
  }
}

const failureOf = (subject: object): string => {
  try {
    expectNoSecret(subject, ['another value', PASSWORD]);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  return 'no failure';
};

describe('expectNoSecret', () => {
  it('passes for an adapter that holds its secret in a closure', () => {
    const adapter = new SafeAdapter(PASSWORD);

    expectNoSecret(adapter, [PASSWORD]);

    expect(adapter.open()).toContain(PASSWORD);
  });

  it('fails for a secret kept in a field, saying how it shows and never what it is', () => {
    const failure = failureOf(new LeakingAdapter(PASSWORD));

    expect(failure).toBe('LeakingAdapter shows secret #2 of 2 through JSON.stringify');
    expect(failure).not.toContain(PASSWORD);
  });

  it('fails for a secret that only a spread or a listing of the keys reaches', () => {
    const redacted = Object.assign(new LeakingAdapter(PASSWORD), {
      toJSON: () => 'redacted',
      [inspect.custom]: () => 'redacted',
    });

    Object.defineProperty(redacted, 'toJSON', { enumerable: false });

    expect(failureOf(redacted)).toBe('LeakingAdapter shows secret #2 of 2 through an object spread');
  });

  it('fails for a secret deeper than a log shows by default, and for one in a hidden property of what a key leads to', () => {
    const deep = { a: { b: { c: { d: { e: PASSWORD } } } } };
    const hidden = { client: Object.defineProperty({}, 'password', { value: PASSWORD, enumerable: false }) };

    expect(inspect(deep)).not.toContain(PASSWORD);
    expect(failureOf(deep)).toContain('through JSON.stringify');
    expect(failureOf(hidden)).toContain('through an object spread');
  });

  it('passes for a field taken out of enumeration behind a redacted serialisation and inspection', () => {
    class ConcealedAdapter extends LeakingAdapter {
      constructor() {
        super(PASSWORD);
        Object.defineProperty(this, 'options', { enumerable: false });
      }

      toJSON(): string {
        return 'ConcealedAdapter';
      }

      [inspect.custom](): string {
        return 'ConcealedAdapter';
      }
    }

    expectNoSecret(new ConcealedAdapter(), [PASSWORD]);
  });

  it('looks through the other views when JSON cannot serialise the object, or serialises it to nothing', () => {
    const cyclic: Record<string, unknown> = Object.assign(Object.create(null), { password: PASSWORD });
    const silent = { toJSON: () => undefined, password: PASSWORD };

    cyclic['self'] = cyclic;

    expect(failureOf(cyclic)).toBe('The object shows secret #2 of 2 through an object spread');
    expect(failureOf(silent)).toBe('Object shows secret #2 of 2 through an object spread');
  });
});
