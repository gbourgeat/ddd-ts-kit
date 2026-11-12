import { matchingBracket } from '../text/matching-bracket';
import { splitTopLevel } from '../text/split-top-level';

const CALL = /^([A-Za-z_$][\w$]*)\s*\(/;
const NUMBER = /^\d[\d_]*$/;
/** The aspects of `@ddd-ts-kit/aspects` that state no time limit and no policy of their own. */
const WITHOUT_LIMIT = ['retry', 'circuitBreaker', 'cached', 'bulkhead', 'logged', 'timed'];

/** What a list of aspects states, each element read as text. */
export interface StatedPolicy {
  /** Whether `ownPolicy(...)` is an element: the default policy of the platform then leaves the adapter alone. */
  readonly ownPolicy: boolean;
  /** The durations of the `timeout(<number>)` that are elements of the list or arguments of its `ownPolicy(...)`. */
  readonly timeouts: readonly number[];
  /**
   * False when an element may state a limit or a policy the text does not show: a `timeout(...)` given
   * anything but a number, an aspect under `when(...)`, a variable, a spread, a call of another name.
   */
  readonly readable: boolean;
}

/**
 * Reads the elements of an aspects list. A `timeout(` nested in the options of another aspect is
 * not an element, and states nothing here.
 */
export function statedPolicy(elements: readonly string[]): StatedPolicy {
  return elements.map(statedBy).reduce(
    (all, one) => ({
      ownPolicy: all.ownPolicy || one.ownPolicy,
      timeouts: [...all.timeouts, ...one.timeouts],
      readable: all.readable && one.readable,
    }),
    { ownPolicy: false, timeouts: [], readable: true },
  );
}

function statedBy(element: string): StatedPolicy {
  const call = CALL.exec(element);
  const open = call === null ? -1 : call[0].length - 1;

  if (call === null || matchingBracket(element, open) !== element.length - 1) {
    return { ownPolicy: false, timeouts: [], readable: false };
  }

  const given = splitTopLevel(element.slice(open + 1, -1))
    .map(({ code }) => code)
    .filter((code) => code !== '');

  if (call[1] === 'ownPolicy') {
    return { ...statedPolicy(given), ownPolicy: true };
  }

  return call[1] === 'timeout'
    ? limitOf(given[0] ?? '')
    : { ownPolicy: false, timeouts: [], readable: WITHOUT_LIMIT.includes(call[1] ?? '') };
}

function limitOf(duration: string): StatedPolicy {
  return NUMBER.test(duration)
    ? { ownPolicy: false, timeouts: [Number(duration.replaceAll('_', ''))], readable: true }
    : { ownPolicy: false, timeouts: [], readable: false };
}
