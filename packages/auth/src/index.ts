export {
  FORBIDDEN,
  UNAUTHORIZED,
  AuthorizationSetupError,
  ForbiddenError,
  InvalidCredentialError,
  ListingNotSupportedError,
  MissingActorError,
  UnauthenticatedError,
  UndeclaredUseCaseError,
} from './errors.js';
export {
  PermissionRegistry,
  definePermissions,
  isPermission,
  type Permission,
  type PermissionDeclaration,
  type PermissionSet,
} from './permissions.js';
export {
  ALLOWED,
  DenialReason,
  deny,
  type AccessScope,
  type AuthorizationContext,
  type Authorizer,
  type CheckRequest,
  type Decision,
  type DecisionRecord,
  type ListRequest,
  type OnDecision,
  type ResourceRef,
} from './authorizer.js';
export {
  AuthorizationMap,
  publicUseCase,
  requires,
  type ProtectedUseCase,
  type PublicUseCase,
  type RequirementOptions,
  type UseCaseDeclaration,
} from './authorization-map.js';
export { authorizationMiddleware, type AuthorizationMiddlewareOptions } from './middleware.js';
export {
  Access,
  NO_POLICY,
  definePolicy,
  isResourceRef,
  type AccessOptions,
  type Policy,
  type PolicyContext,
} from './policy.js';
export type { Grant } from './grants.js';
export { RoleBasedAuthorizer, tenantOfContext, type RoleBasedAuthorizerOptions } from './rbac.js';
export {
  PolicyBasedAuthorizer,
  allOf,
  anyOf,
  forbid,
  not,
  permit,
  type AttributePolicy,
  type Condition,
  type PolicyBasedAuthorizerOptions,
  type PolicyInput,
  type ResourceAttributeValues,
  type ResourceAttributes,
} from './abac.js';
export {
  actorOf,
  bearerCredential,
  inActorContext,
  principalResolver,
  type Authenticator,
  type HeaderValues,
} from './authentication.js';
