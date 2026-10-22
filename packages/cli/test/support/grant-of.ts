import type { StackFlags } from './stack-flags';

/**
 * `--grant <role>` where the rights of the project are roles, the default; nothing where they are
 * attributes or relationships. The flags given to `init` after the stack have the last word.
 */
export function grantOf(stack: StackFlags, more: readonly string[] = []): (role: string) => string[] {
  const named = more.indexOf('--authz');
  const authz = named === -1 ? (stack.authz ?? 'rbac') : more[named + 1];

  return (role) => (authz === 'rbac' ? ['--grant', role] : []);
}
