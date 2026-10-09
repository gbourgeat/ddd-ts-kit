{{#if http.any}}
import type { Authenticator } from '@ddd-ts-kit/auth';
{{/if}}
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import type { ContextModule } from '@ddd-ts-kit/di';
import { accessPolicies } from './access-policies.js';
import { auditDecision } from './audit.js';
import { createAuthorizer } from './authorizer.js';

/** Binds the guard both buses ask before any handler, the `Access` of the policies and the audit trail. */
{{#if http.any}}
export function authorization(authenticator: Authenticator): ContextModule {
  return authorizationModule({ authorizer: createAuthorizer(), authenticator, policies: accessPolicies, onDecision: auditDecision });
}
{{/if}}
{{#unless http.any}}
export function authorization(): ContextModule {
  return authorizationModule({ authorizer: createAuthorizer(), policies: accessPolicies, onDecision: auditDecision });
}
{{/unless}}
