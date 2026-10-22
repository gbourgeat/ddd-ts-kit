import { AsyncLocalStorage } from 'node:async_hooks';
import type { Method } from './method';
import { named } from './named';

interface AdvisedCall {
  readonly application: object;
  running: boolean;
}

// The advised calls the current asynchronous flow is inside of, outermost first.
const callsInProgress = new AsyncLocalStorage<readonly AdvisedCall[]>();

/**
 * The advice for a call that reaches the instance from outside, the method itself for a call
 * made while an advised call of the same application (one aspect on one instance) is running
 * in the same asynchronous flow: what the instance calls on itself, through a public or a
 * `private` method, is the inside of the call being advised, not another call to advise.
 * Concurrent calls from outside are separate flows: each is advised.
 */
export function fromOutside(original: Method, wrapper: Method, application: object): Method {
  const entry: Method = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
    const outer = callsInProgress.getStore() ?? [];

    if (outer.some((call) => call.running && call.application === application)) {
      return original.apply(this, args);
    }

    const call: AdvisedCall = { application, running: true };

    try {
      return await callsInProgress.run([...outer, call], () => wrapper.apply(this, args));
    } finally {
      // What the call left behind (a timer, a listener) is a caller from outside once it is over.
      call.running = false;
    }
  };

  return named(entry, original);
}
