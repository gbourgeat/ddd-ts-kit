import { WiringError } from '../../src/index.js';

/** The wiring error a promise rejects with. */
export async function wiringRejection(work: Promise<unknown>): Promise<WiringError> {
  const outcome = await work.then(
    () => undefined,
    (error: unknown) => error,
  );

  if (!(outcome instanceof WiringError)) throw new Error(`Expected a WiringError, got ${String(outcome)}`);

  return outcome;
}
