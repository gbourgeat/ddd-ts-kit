// The helper of @ddd-ts-kit/testing, which this package does not depend on.
import { AssertionError } from 'node:assert';
import { inspect } from 'node:util';

const EVERYTHING = {
  depth: Infinity,
  showHidden: true,
  maxArrayLength: Infinity,
  maxStringLength: Infinity,
  breakLength: Infinity,
};

/**
 * Asserts that an object the application holds (an adapter, a provider) shows none of the
 * secrets it was built with: not when it is serialised with `JSON.stringify`, not when it is
 * spread, not through the values `Object.keys` leads to, not when it is logged with
 * `util.inspect`, at any depth. Give the values as they were given to the adapter: a password,
 * a key, a connection URL.
 */
export function expectNoSecret(subject: object, secrets: readonly string[]): void {
  for (const [view, shown] of Object.entries(viewsOf(subject))) {
    const leaked = secrets.findIndex((secret) => shown.includes(secret));

    if (leaked === -1) {
      continue;
    }

    // The secret itself is kept out of the failure: a test report is read by many.
    throw new AssertionError({
      message: `${nameOf(subject)} shows secret #${leaked + 1} of ${secrets.length} through ${view}`,
      operator: 'expectNoSecret',
    });
  }
}

function viewsOf(subject: object): Readonly<Record<string, string>> {
  const spread = { ...subject };

  return {
    'JSON.stringify': serialised(subject),
    'an object spread': `${serialised(spread)}\n${inspect(spread, EVERYTHING)}`,
    'the values under Object.keys': Object.keys(subject)
      .map((key) => inspect(Reflect.get(subject, key), EVERYTHING))
      .join('\n'),
    'util.inspect': `${inspect(subject)}\n${inspect(subject, EVERYTHING)}`,
  };
}

/** What cannot be serialised (a cycle, a BigInt) or serialises to nothing shows nothing this way. */
function serialised(value: object): string {
  try {
    const text: unknown = JSON.stringify(value);

    return typeof text === 'string' ? text : '';
  } catch {
    return '';
  }
}

function nameOf(subject: object): string {
  const constructor: unknown = Reflect.get(subject, 'constructor');

  return typeof constructor === 'function' && constructor.name !== '' ? constructor.name : 'The object';
}
