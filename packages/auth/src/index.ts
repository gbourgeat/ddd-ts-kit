export { AuthorizationSetupError } from './errors/authorization-setup-error.js';
export { FORBIDDEN, ForbiddenError } from './errors/forbidden-error.js';
export { InvalidCredentialError } from './errors/invalid-credential-error.js';
export { ListingNotSupportedError } from './errors/listing-not-supported-error.js';
export { MissingActorError } from './errors/missing-actor-error.js';
export { UNAUTHORIZED, UnauthenticatedError } from './errors/unauthenticated-error.js';
export { PolicyNotAskedError } from './errors/policy-not-asked-error.js';
export { UndeclaredUseCaseError } from './errors/undeclared-use-case-error.js';
export { definePermissions, type PermissionDeclaration, type PermissionSet } from './permissions/define-permissions.js';
export type { Grant } from './permissions/grant.js';
export { isPermission } from './permissions/is-permission.js';
export type { Permission } from './permissions/permission.js';
export { PermissionRegistry } from './permissions/permission-registry.js';
export { Access } from './authorization/access.js';
export type { AccessQuestion } from './authorization/access-question.js';
export type { AccessScope } from './authorization/access-scope.js';
export type { AuthorizationContext } from './authorization/authorization-context.js';
export { Authorizer } from './authorization/authorizer.js';
export type { CheckRequest } from './authorization/check-request.js';
export { ALLOWED, deny, type Decision } from './authorization/decision.js';
export type { DecisionRecord } from './authorization/decision-record.js';
export type { Explanation } from './authorization/explanation.js';
export { Trace } from './authorization/trace.js';
export type { TraceStep } from './authorization/trace-step.js';
export { traceText } from './authorization/trace-text.js';
export { DenialReason } from './authorization/denial-reason.js';
export { isResourceRef } from './authorization/is-resource-ref.js';
export type { ListRequest } from './authorization/list-request.js';
export type { OnDecision } from './authorization/on-decision.js';
export type { ResourceRef } from './authorization/resource-ref.js';
export { AuthorizationMap } from './use-cases/authorization-map.js';
export { authorizationMiddleware, type AuthorizationMiddlewareOptions } from './use-cases/authorization-middleware.js';
export {
  policiesAskedMiddleware,
  type PoliciesAskedMiddlewareOptions,
} from './use-cases/policies-asked-middleware.js';
export { publicUseCase } from './use-cases/public-use-case.js';
export { requires, type RequirementOptions } from './use-cases/requires.js';
export type { ProtectedUseCase, PublicUseCase, UseCaseDeclaration } from './use-cases/use-case-declaration.js';
export { definePolicy } from './policies/define-policy.js';
export type { Policy } from './policies/policy.js';
export { NO_POLICY, PolicyAccess, type PolicyAccessOptions } from './policies/policy-access.js';
export type { PolicyContext } from './policies/policy-context.js';
export { RoleBasedAuthorizer, type RoleBasedAuthorizerOptions } from './rbac/role-based-authorizer.js';
export { tenantOfContext } from './rbac/tenant-of-context.js';
export { forbid, permit, type AttributePolicy } from './abac/attribute-policy.js';
export { allOf, anyOf, not, type Condition } from './abac/condition.js';
export { PolicyBasedAuthorizer, type PolicyBasedAuthorizerOptions } from './abac/policy-based-authorizer.js';
export {
  SignedInGrantsAuthorizer,
  type SignedInGrantsAuthorizerOptions,
} from './signed-in/signed-in-grants-authorizer.js';
export type { PolicyInput } from './abac/policy-input.js';
export type { ResourceAttributeValues } from './abac/resource-attribute-values.js';
export { ResourceAttributes } from './abac/resource-attributes.js';
export { actorOf } from './authentication/actor-of.js';
export { Authenticator } from './authentication/authenticator.js';
export { bearerCredential } from './authentication/bearer-credential.js';
export type { HeaderValues } from './authentication/header-values.js';
export { inActorContext } from './authentication/in-actor-context.js';
export { principalResolver } from './authentication/principal-resolver.js';
export { resolveSession } from './authentication/resolve-session.js';
export { SessionAuthenticator } from './authentication/session-authenticator.js';
export { sessionOf } from './authentication/session-of.js';
