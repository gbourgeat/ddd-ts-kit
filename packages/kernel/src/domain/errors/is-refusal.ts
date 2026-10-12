import { DomainError } from './domain-error.js';

/**
 * Whether what was caught is a business refusal and, when a code is given, this one. Whatever
 * its class: the code is the identity of a refusal.
 */
export function isRefusal<const Code extends string = string>(
  error: unknown,
  code?: Code,
): error is DomainError & { readonly code: Code } {
  return error instanceof DomainError && (code === undefined || error.code === code);
}
