import { portDefect, type Token } from '@ddd-ts-kit/kernel/declarations';
import { WiringError } from '../errors/wiring-error';

/** A port is an abstract class with abstract members only, and its adapter implements it without extending it. */
export function assertPort(port: Token<unknown>, implementation: Token<unknown>, module: string): void {
  const defect = portDefect(port, implementation);

  if (defect !== undefined) {
    throw new WiringError('INVALID_PORT', `Module "${module}": ${defect}`);
  }
}
