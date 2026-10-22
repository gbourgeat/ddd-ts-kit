import { DomainError } from './domain-error';

/**
 * Whether what was caught is a business refusal and, when a code is given, this one; when the
 * closed list of the codes of a context is given (`SchedulingCodes`), one of them, so that a
 * `switch` on the code is exhaustive. Whatever its class: the code is the identity of a refusal.
 */
export function isRefusal<const Code extends string = string>(
  error: unknown,
  code?: Code | Readonly<Record<string, Code>>,
): error is DomainError & { readonly code: Code } {
  if (!(error instanceof DomainError)) {
    return false;
  }

  if (code === undefined) {
    return true;
  }

  return typeof code === 'string' ? error.code === code : Object.values<string>(code).includes(error.code);
}
