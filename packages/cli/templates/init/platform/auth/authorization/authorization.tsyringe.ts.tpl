{{#if http.any}}
import type { Authenticator, OnDecision } from '@ddd-ts-kit/auth';
{{/if}}
{{#unless http.any}}
import type { OnDecision } from '@ddd-ts-kit/auth';
{{/unless}}
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import type { ContextModule } from '@ddd-ts-kit/di';
import { accessPolicies } from '{{alias.platform}}/auth/authorization/access-policies{{alias.ext}}';
import { createAuthorizer } from '{{alias.platform}}/auth/authorization/create-authorizer{{alias.ext}}';

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
