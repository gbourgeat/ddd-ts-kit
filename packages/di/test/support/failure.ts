import { WiringError } from '../../src/index.js';

export function wiringFailure(run: () => unknown): WiringError {
  try {
    run();
  } catch (error) {
    if (error instanceof WiringError) return error;
    throw error;
  }
  throw new Error('expected a WiringError');
}
