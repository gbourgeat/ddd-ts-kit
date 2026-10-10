import type { DeclaredPolicy, PermissionRef, Token } from '@ddd-ts-kit/kernel/declarations';
import type { Declarer } from './declarer.js';

/** A policy class a context declared, for the authorization module to evaluate. */
export interface PolicyBinding {
  readonly name: string;
  readonly permission: PermissionRef;
  readonly policy: Token<DeclaredPolicy>;
  readonly module: string;
  readonly declaredBy?: Declarer;
}
