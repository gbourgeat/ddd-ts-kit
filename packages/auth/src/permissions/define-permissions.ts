import { AuthorizationSetupError } from '../errors/authorization-setup-error';
import type { Permission } from './permission';

export interface PermissionDeclaration {
  readonly description: string;
}

export type PermissionSet<Context extends string, Name extends string> = {
  readonly [N in Name]: Permission<`${Context}:${N}`>;
};

const CONTEXT_PATTERN = /^[a-z][a-z0-9-]*$/;
const NAME_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;

/**
 * The permissions of one bounded context, as data:
 * `definePermissions('billing', { 'invoice.issue': { description: 'Issue an invoice' } })`.
 */
export function definePermissions<
  const Context extends string,
  const Declarations extends Readonly<Record<string, PermissionDeclaration>>,
>(context: Context, declarations: Declarations): PermissionSet<Context, keyof Declarations & string> {
  assertMatches(context, CONTEXT_PATTERN, 'context');

  const permissions = Object.entries(declarations).map(([name, { description }]) => {
    assertMatches(name, NAME_PATTERN, 'permission');

    return [name, Object.freeze({ id: `${context}:${name}`, context, name, description })];
  });

  // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- one entry was built per key of Declarations with the id of that key, which the compiler cannot follow through Object.fromEntries
  return Object.freeze(Object.fromEntries(permissions)) as PermissionSet<Context, keyof Declarations & string>;
}

function assertMatches(value: string, pattern: RegExp, what: string): void {
  if (pattern.test(value)) {
    return;
  }

  throw new AuthorizationSetupError(
    `"${value}" is not a valid ${what} name: lower-case words, digits and dashes${what === 'permission' ? ', dot-separated' : ''}.`,
  );
}
