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
import { Authenticator } from '../authentication/authenticator.js';
import { Access } from '../authorization/access.js';
import { Authorizer } from '../authorization/authorizer.js';
import type { OnDecision } from '../authorization/on-decision.js';
import { AuthorizationSetupError } from '../errors/authorization-setup-error.js';
import { isPermission } from '../permissions/is-permission.js';
import { definePolicy } from '../policies/define-policy.js';
import type { Policy } from '../policies/policy.js';
import { PolicyAccess, type PolicyAccessOptions } from '../policies/policy-access.js';
import { AuthorizationMap } from '../use-cases/authorization-map.js';
import { authorizationMiddleware } from '../use-cases/authorization-middleware.js';
import { authorizationMapOf } from './authorization-map-of.js';

export interface AuthorizationModuleOptions {
  /** The model: role based, policy based, relation based, or an adapter of a dedicated service. */
  readonly authorizer: Provided<Authorizer>;
  readonly authenticator?: Provided<Authenticator>;
  /** The instance-level policies of every context, evaluated by `Access` next to the classes declared with `@Policy`. */
  readonly policies?: readonly Policy<unknown>[];
  readonly resourceOf?: PolicyAccessOptions['resourceOf'];
  /** The audit hook, called for every decision of the buses and of `Access`. */
  readonly onDecision?: OnDecision;
}

/**
 * Turns the declarations of the modules into enforcement: binds the use case guard the kernel
 * buses run first, so a command or query that declared no access is refused, and a protected
 * one reaches its handler only when the authorizer allows the actor it carries. Starting the
 * application builds the guard, so a declaration that is not a permission fails the start.
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
  const declared = resolve(DeclaredPolicies).list.map((binding) => policyOf(binding, resolve));

  return new PolicyAccess({
    authorizer: resolve(Authorizer),
    clock: resolve(Clock),
    scope: resolve(ExecutionScope),
    policies: [...(options.policies ?? []), ...declared],
    ...(resourceOf === undefined ? {} : { resourceOf }),
    ...(onDecision === undefined ? {} : { onDecision }),
  });
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

function guardOf({ onDecision }: AuthorizationModuleOptions, resolve: Resolve): UseCaseGuard {
  const check = authorizationMiddleware({
    authorizer: resolve(Authorizer),
    map: resolve(AuthorizationMap),
    scope: resolve(ExecutionScope),
    ...(onDecision === undefined ? {} : { onDecision }),
  });

  return { check };
}
