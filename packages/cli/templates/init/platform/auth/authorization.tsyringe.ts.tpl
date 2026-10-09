{{#if http.any}}
import type { Authenticator, OnDecision } from '@ddd-ts-kit/auth';
{{/if}}
{{#unless http.any}}
import type { OnDecision } from '@ddd-ts-kit/auth';
{{/unless}}
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import type { ContextModule } from '@ddd-ts-kit/di';
import { accessPolicies } from './access-policies.js';
import { createAuthorizer } from './authorizer.js';

/** Binds the guard both buses ask before any handler and the `Access` of the policies; `onDecision` is told every decision, allowed or refused. */
{{#if http.any}}
export function authorization(authenticator: Authenticator, onDecision: OnDecision): ContextModule {
  return authorizationModule({ authorizer: createAuthorizer(), authenticator, policies: accessPolicies, onDecision });
}
{{/if}}
{{#unless http.any}}
export function authorization(onDecision: OnDecision): ContextModule {
  return authorizationModule({ authorizer: createAuthorizer(), policies: accessPolicies, onDecision });
}
{{/unless}}
