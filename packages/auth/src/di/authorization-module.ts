import {
  DeclaredPolicies,
  UseCaseDeclarations,
  UseCaseGuard,
  defineContextModule,
  type ContextModule,
  type PolicyBinding,
  type Provided,
  type Resolve,
} from '@ddd-ts-kit/di';
import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';
import { Authenticator } from '../authentication/authenticator';
import { Access } from '../authorization/access';
import { Authorizer } from '../authorization/authorizer';
import type { OnDecision } from '../authorization/on-decision';
import { AuthorizationSetupError } from '../errors/authorization-setup-error';
import { isPermission } from '../permissions/is-permission';
import { definePolicy } from '../policies/define-policy';
import type { Policy } from '../policies/policy';
import { PolicyAccess, type PolicyAccessOptions } from '../policies/policy-access';
import { AuthorizationMap } from '../use-cases/authorization-map';
import { authorizationMiddleware } from '../use-cases/authorization-middleware';
import { policiesAskedMiddleware } from '../use-cases/policies-asked-middleware';
import { authorizationMapOf } from './authorization-map-of';

export interface AuthorizationModuleOptions {
  /** The model: role based, policy based, relation based, or an adapter of a dedicated service. */
  readonly authorizer: Provided<Authorizer>;
  readonly authenticator?: Provided<Authenticator>;
  /** The instance-level policies of every context, evaluated by `Access` next to the classes declared with `@Policy`. */
  readonly policies?: readonly Policy<unknown>[];
  readonly resourceOf?: PolicyAccessOptions['resourceOf'];
  /** The audit hook, called for every decision of the buses and of `Access`. */
  readonly onDecision?: OnDecision;
  /**
   * Whether a handler whose permission a policy refines has to ask `Access` about it, and be
   * allowed, before it returns; otherwise its result is refused with `PolicyNotAskedError` (or
   * `PolicyDenialIgnoredError` for a success with no question allowed) and its change rolled back. On by default; turn it off only for an `Access` of the project other than `PolicyAccess`.
   */
  readonly policiesAsked?: boolean;
}

/**
 * Turns the declarations of the modules into enforcement: binds the use case guard the kernel
 * buses run first, so a command or query that declared no access is refused, and a protected
 * one reaches its handler only when the authorizer allows the actor it carries. When a policy
 * refines the permission, the handler has to ask `Access` about it before it returns. Starting
 * the application builds the guard, so a declaration that is not a permission fails the start.
 */
export function authorizationModule(options: AuthorizationModuleOptions): ContextModule {
  const { authenticator } = options;

  return defineContextModule({
    name: 'authorization',
    register(builder) {
      builder.bind(Authorizer).toFactory(provided(options.authorizer));

      if (authenticator !== undefined) {
        builder.bind(Authenticator).toFactory(provided(authenticator));
      }

      builder.bind(AuthorizationMap).toFactory((resolve) => authorizationMapOf(resolve(UseCaseDeclarations).list));
      builder.bind(Access).toFactory((resolve) => accessOf(options, resolve));
      builder.bind(UseCaseGuard).toFactory((resolve) => guardOf(options, resolve));
    },
    onStart({ resolve }) {
      resolve(UseCaseGuard);
    },
  });
}

function provided<T>(value: Provided<T>): (resolve: Resolve) => T {
  return isFactory(value) ? value : () => value;
}

function isFactory<T>(value: Provided<T>): value is (resolve: Resolve) => T {
  return typeof value === 'function';
}

function accessOf(options: AuthorizationModuleOptions, resolve: Resolve): Access {
  const { resourceOf, onDecision } = options;

  return new PolicyAccess({
    authorizer: resolve(Authorizer),
    clock: resolve(Clock),
    scope: resolve(ExecutionScope),
    policies: policiesOf(options, resolve),
    ...(resourceOf === undefined ? {} : { resourceOf }),
    ...(onDecision === undefined ? {} : { onDecision }),
  });
}

/** The policies given to the module, then the classes the contexts declared with `@Policy`. */
function policiesOf(options: AuthorizationModuleOptions, resolve: Resolve): Policy<unknown>[] {
  const declared = resolve(DeclaredPolicies).list.map((binding) => policyOf(binding, resolve));

  return [...(options.policies ?? []), ...declared];
}

/** A class a context declared with `@Policy`, built by its binding the first time it is asked. */
function policyOf(binding: PolicyBinding, resolve: Resolve): Policy<unknown> {
  const { name, permission, module, policy } = binding;

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

function guardOf(options: AuthorizationModuleOptions, resolve: Resolve): UseCaseGuard {
  const { onDecision, policiesAsked } = options;
  const map = resolve(AuthorizationMap);

  const check = authorizationMiddleware({
    authorizer: resolve(Authorizer),
    map,
    scope: resolve(ExecutionScope),
    ...(onDecision === undefined ? {} : { onDecision }),
  });

  if (policiesAsked === false) {
    return { check };
  }

  const refined = policiesOf(options, resolve).map((policy) => policy.permission);

  return { check, within: policiesAskedMiddleware({ map, refined }) };
}
