import {
  CLOCK,
  DECLARED_POLICIES,
  USE_CASE_DECLARATIONS,
  USE_CASE_GUARD,
  defineContextModule,
  type ContextModule,
  type PolicyBinding,
  type Provided,
  type Resolve,
  type UseCaseDeclaration as DeclaredUseCase,
} from '@ddd-ts-kit/di';
import type { Authenticator } from './authentication.js';
import { ACCESS, AUTHENTICATOR, AUTHORIZATION_MAP, AUTHORIZER } from './tokens.js';
import { AuthorizationMap, publicUseCase, type UseCaseDeclaration } from './authorization-map.js';
import type { Authorizer, OnDecision } from './authorizer.js';
import { AuthorizationSetupError } from './errors.js';
import { authorizationMiddleware } from './middleware.js';
import { isPermission } from './permissions.js';
import { Access, definePolicy, type AccessOptions, type Policy } from './policy.js';

export { ACCESS, AUTHENTICATOR, AUTHORIZATION_MAP, AUTHORIZER };

export interface AuthorizationModuleOptions {
  /** The model: role based, policy based, relation based, or an adapter of a dedicated service. */
  readonly authorizer: Provided<Authorizer>;
  readonly authenticator?: Provided<Authenticator>;
  /** The instance-level policies of every context, evaluated by `ACCESS` next to the classes declared with `@Policy`. */
  readonly policies?: readonly Policy<unknown>[];
  readonly resourceOf?: AccessOptions['resourceOf'];
  /** The audit hook, called for every decision of the buses and of `ACCESS`. */
  readonly onDecision?: OnDecision;
}

/**
 * Turns the declarations of the modules into enforcement: binds the use case guard the kernel
 * buses run first, so a command or query that declared no access is refused, and a protected
 * one reaches its handler only when the authorizer allows the actor it carries. Starting the
 * application builds the guard, so a declaration that is not a permission fails the start.
 */
export function authorizationModule(options: AuthorizationModuleOptions): ContextModule {
  const { authenticator, onDecision } = options;
  return defineContextModule({
    name: 'authorization',
    register(builder) {
      builder.bind(AUTHORIZER).toFactory(provided(options.authorizer));
      if (authenticator !== undefined) builder.bind(AUTHENTICATOR).toFactory(provided(authenticator));
      builder.bind(AUTHORIZATION_MAP).toFactory((resolve) => authorizationMapOf(resolve(USE_CASE_DECLARATIONS)));
      builder.bind(ACCESS).toFactory((resolve) => accessOf(options, resolve));
      builder.bind(USE_CASE_GUARD).toFactory((resolve) =>
        authorizationMiddleware({
          authorizer: resolve(AUTHORIZER),
          map: resolve(AUTHORIZATION_MAP),
          ...(onDecision === undefined ? {} : { onDecision }),
        }),
      );
    },
    onStart({ resolve }) {
      resolve(USE_CASE_GUARD);
    },
  });
}

function provided<T>(value: Provided<T>): (resolve: Resolve) => T {
  return isFactory(value) ? value : () => value;
}

function isFactory<T>(value: Provided<T>): value is (resolve: Resolve) => T {
  return typeof value === 'function';
}

/** A use case that declared nothing is left out, hence refused when it is sent. */
export function authorizationMapOf(declared: readonly DeclaredUseCase[]): AuthorizationMap {
  return new AuthorizationMap(declared.flatMap(declarationOf));
}

function declarationOf(declared: DeclaredUseCase): UseCaseDeclaration[] {
  if (declared.access === undefined) return [];
  if (declared.access === 'public') return [publicUseCase(declared.message)];
  const { permission } = declared;
  if (!isPermission(permission)) {
    throw new AuthorizationSetupError(
      `Module "${declared.module}" protects ${declared.message.name} with something that is not a permission made by definePermissions.`,
    );
  }
  return [
    {
      access: 'protected',
      type: declared.message,
      permission,
      resourceOf: (message) => declared.resourceOf?.(message),
      contextOf: (message) => declared.contextOf?.(message),
    },
  ];
}

function accessOf(options: AuthorizationModuleOptions, resolve: Resolve): Access {
  const { resourceOf, onDecision } = options;
  return new Access({
    authorizer: resolve(AUTHORIZER),
    clock: resolve(CLOCK),
    policies: [...(options.policies ?? []), ...resolve(DECLARED_POLICIES).map((declared) => policyOf(declared, resolve))],
    ...(resourceOf === undefined ? {} : { resourceOf }),
    ...(onDecision === undefined ? {} : { onDecision }),
  });
}

/** A class a context declared with `@Policy`, built by its binding the first time it is asked. */
function policyOf(declared: PolicyBinding, resolve: Resolve): Policy<unknown> {
  const { name, permission, module, policy } = declared;
  if (!isPermission(permission)) {
    throw new AuthorizationSetupError(
      `Module "${module}" declares the policy "${name}" for something that is not a permission made by definePermissions.`,
    );
  }
  return definePolicy({
    name,
    permission,
    appliesTo: (subject): subject is unknown => resolve(policy).appliesTo?.(subject) ?? true,
    allows: (actor, subject, context) => resolve(policy).allows(actor, subject, context),
  });
}
