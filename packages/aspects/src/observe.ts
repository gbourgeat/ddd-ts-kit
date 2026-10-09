import type { Clock } from '@ddd-ts-kit/kernel';
import { describeError, isBusinessRefusal, type ErrorDescription } from './errors.js';

export interface CallOutcome {
  readonly durationMs: number;
  /** Present when the call failed. */
  readonly error?: ErrorDescription;
  /** True when the failure is a business refusal rather than a fault. */
  readonly refused: boolean;
}

/**
 * Runs the call and reports how it went, once. The result and the error pass through
 * untouched; a report that throws never changes the outcome of the call.
 */
export async function observed<T>(
  clock: Clock,
  call: () => Promise<T>,
  report: (outcome: CallOutcome) => void,
): Promise<T> {
  const startedAt = clock.now().getTime();
  const elapsed = (): number => clock.now().getTime() - startedAt;
  let result: T;
  try {
    result = await call();
  } catch (error) {
    const outcome = { durationMs: elapsed(), error: describeError(error), refused: isBusinessRefusal(error) };
    safely(() => {
      report(outcome);
    });
    throw error;
  }
  safely(() => {
    report({ durationMs: elapsed(), refused: false });
  });
  return result;
}

/** Observation must never break what it observes. */
export function safely(act: () => void): void {
  try {
    act();
  } catch {
    return;
  }
}
