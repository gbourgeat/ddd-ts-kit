import { isAnonymous, type Actor, type ActorAttribute, type Clock } from '@ddd-ts-kit/kernel';
import {
  ALLOWED,
  DenialReason,
  deny,
  type AuthorizationContext,
  type Authorizer,
  type CheckRequest,
  type Decision,
  type ResourceRef,
} from './authorizer.js';
import { grantCovers, grantPattern, type Grant } from './grants.js';
import type { Permission } from './permissions.js';

export type ResourceAttributeValues = Readonly<Record<string, ActorAttribute>>;

/** Where the attributes of an element come from: a projection, a cache, the owning context. */
export interface ResourceAttributes {
  of(resource: ResourceRef): Promise<ResourceAttributeValues | undefined>;
}

/** Everything a rule may look at. */
export interface PolicyInput {
  readonly actor: Actor;
  readonly permission: Permission;
  readonly resource?: ResourceRef;
  /** Empty when the request names no resource or the port knows nothing about it. */
  readonly attributes: ResourceAttributeValues;
  readonly context: AuthorizationContext;
  /** From the `Clock` port. */
  readonly now: Date;
}

export type Condition = (input: PolicyInput) => boolean;

export interface AttributePolicy {
  readonly name: string;
  readonly effect: 'permit' | 'forbid';
  readonly grants: readonly string[];
  readonly when: Condition;
}

/** Allows the permissions when the condition holds, unless a `forbid` policy applies. */
export function permit(name: string, permissions: readonly Grant[], when: Condition = () => true): AttributePolicy {
  return { name, effect: 'permit', grants: permissions.map(grantPattern), when };
}

/** Refuses the permissions when the condition holds, whatever the `permit` policies say. */
export function forbid(name: string, permissions: readonly Grant[], when: Condition = () => true): AttributePolicy {
  return { name, effect: 'forbid', grants: permissions.map(grantPattern), when };
}

export function anyOf(...conditions: readonly Condition[]): Condition {
  return (input) => conditions.some((condition) => condition(input));
}

export function allOf(...conditions: readonly Condition[]): Condition {
  return (input) => conditions.every((condition) => condition(input));
}

export function not(condition: Condition): Condition {
  return (input) => !condition(input);
}

export interface PolicyBasedAuthorizerOptions {
  readonly policies: readonly AttributePolicy[];
  readonly clock: Clock;
  readonly attributes?: ResourceAttributes;
}

/**
 * ABAC: rules over the attributes of the actor, of the resource and of the moment. A matching
 * `forbid` wins over every `permit`; with no matching `permit` the answer is no. It does not
 * implement `listAccessible`: an arbitrary predicate cannot be turned into a query.
 */
export class PolicyBasedAuthorizer implements Authorizer {
  constructor(private readonly options: PolicyBasedAuthorizerOptions) {}

  async check(request: CheckRequest): Promise<Decision> {
    if (isAnonymous(request.actor)) return deny(DenialReason.anonymous);
    const input = await this.#inputOf(request);
    const applying = this.options.policies.filter(
      (policy) => policy.grants.some((pattern) => grantCovers(pattern, request.permission)) && policy.when(input),
    );
    if (applying.some((policy) => policy.effect === 'forbid')) return deny(DenialReason.explicitDeny);
    return applying.length > 0 ? ALLOWED : deny(DenialReason.noMatchingPolicy);
  }

  async #inputOf(request: CheckRequest): Promise<PolicyInput> {
    const { resource } = request;
    const attributes = resource === undefined ? undefined : await this.options.attributes?.of(resource);
    return {
      actor: request.actor,
      permission: request.permission,
      ...(resource === undefined ? {} : { resource }),
      attributes: attributes ?? {},
      context: request.context ?? {},
      now: this.options.clock.now(),
    };
  }
}
