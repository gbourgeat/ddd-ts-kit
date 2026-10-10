import { noteAttempt } from './attempts.js';

class Unreachable extends Error {}

/** A provider that does not answer the first time it is asked. */
export abstract class FlakyRates {
  protected attempt(): number {
    if (noteAttempt(this) === 1) throw new Unreachable('the provider did not answer');

    return 1.08;
  }
}
