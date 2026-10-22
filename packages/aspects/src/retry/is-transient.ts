import { BulkheadFullError } from '../errors/bulkhead-full-error';
import { CircuitOpenError } from '../errors/circuit-open-error';
import { isBusinessRefusal } from '../errors/is-business-refusal';

/**
 * Worth another attempt: anything but a business refusal and the two refusals of this package
 * that protect a dependency (an open circuit, a full bulkhead).
 */
export function isTransient(error: unknown): boolean {
  return !(isBusinessRefusal(error) || error instanceof CircuitOpenError || error instanceof BulkheadFullError);
}
