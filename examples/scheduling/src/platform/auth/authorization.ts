import type { Authenticator, OnDecision } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import type { ContextModule } from '@ddd-ts-kit/di';
import { accessPolicies } from './access-policies.js';
import { createAuthorizer } from './create-authorizer.js';
import { resourceOf } from './resource-of.js';

/**
 * Binds `Authorizer`, the guard both buses ask before any handler, the `Access` of the policies and
 * the `Authenticator` of the HTTP boundary; `onDecision` is told every decision, allowed or refused.
 * The authorizer reads the relation tuple store the platform module binds, the one the adapters write to.
 */
export function authorization(onDecision: OnDecision, authenticator: Authenticator): ContextModule {
  return authorizationModule({ authorizer: (resolve) => createAuthorizer(resolve(RelationTupleStore)), authenticator, policies: accessPolicies, resourceOf, onDecision });
}
