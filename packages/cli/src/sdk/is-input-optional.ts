import type { ClientOperation } from './client-operation.js';

/** True when a call can leave the input out: nothing in it is required. */
export function isInputOptional(operation: ClientOperation): boolean {
  return !operation.parameters.some((parameter) => parameter.required) && operation.body?.required !== true;
}
