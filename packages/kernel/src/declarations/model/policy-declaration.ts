import type { Token } from '../token/token.js';
import type { DeclaredPolicy } from './declared-policy.js';
import type { PermissionRef } from './permission-ref.js';

export interface PolicyDeclaration {
  readonly role: 'policy';
  /** Stable: it is the reason of the refusal when `allows` answers `false`. */
  readonly name: string;
  readonly permission: PermissionRef;
  readonly implementation: new (...args: never) => DeclaredPolicy;
  readonly dependencies: readonly Token<unknown>[];
}
