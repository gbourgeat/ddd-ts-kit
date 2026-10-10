import { describeToken, type Token } from '@ddd-ts-kit/kernel/declarations';
import { WiringError } from '../errors/wiring-error.js';

export function cycleError(path: readonly Token<unknown>[]): WiringError {
  return new WiringError(
    'DEPENDENCY_CYCLE',
    `Dependency cycle: ${path.map((step) => `"${describeToken(step)}"`).join(' -> ')}.`,
  );
}
