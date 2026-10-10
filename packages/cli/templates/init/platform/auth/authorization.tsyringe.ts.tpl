{{#if http.any}}
import type { Authenticator, OnDecision } from '@ddd-ts-kit/auth';
{{/if}}
{{#unless http.any}}
import type { OnDecision } from '@ddd-ts-kit/auth';
{{/unless}}
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import type { ContextModule } from '@ddd-ts-kit/di';
import { accessPolicies } from '{{alias.platform}}/auth/access-policies.js';
import { createAuthorizer } from '{{alias.platform}}/auth/create-authorizer.js';

/**
 * Binds `Authorizer`, the guard both buses ask before any handler, the `Access` of the policies{{#if http.any}} and
 * the `Authenticator` of the HTTP boundary{{/if}}; `onDecision` is told every decision, allowed or refused.
 */
{{#if http.any}}
export function authorization(onDecision: OnDecision, authenticator: Authenticator): ContextModule {
  return authorizationModule({ authorizer: createAuthorizer(), authenticator, policies: accessPolicies, onDecision });
}
{{/if}}
{{#unless http.any}}
export function authorization(onDecision: OnDecision): ContextModule {
  return authorizationModule({ authorizer: createAuthorizer(), policies: accessPolicies, onDecision });
}
{{/unless}}
