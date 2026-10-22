import { isAnonymous, type Clock } from '@ddd-ts-kit/kernel';
import type { Authorizer } from '../authorization/authorizer';
import type { CheckRequest } from '../authorization/check-request';
import { ALLOWED, deny, type Decision } from '../authorization/decision';
import { DenialReason } from '../authorization/denial-reason';
import type { Explanation } from '../authorization/explanation';
import type { ResourceRef } from '../authorization/resource-ref';
import { Trace } from '../authorization/trace';
import { grantCovers } from '../permissions/grant-covers';
import type { Permission } from '../permissions/permission';
import type { AttributePolicy } from './attribute-policy';
import type { PolicyInput } from './policy-input';
import type { ResourceAttributes } from './resource-attributes';

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
    return (await this.explain(request)).decision;
  }

  /** Why: what is known of the element, then each policy that bears on the permission and whether it holds. */
  async explain(request: CheckRequest): Promise<Explanation> {
    const trace = new Trace();

    if (isAnonymous(request.actor)) {
      return { decision: deny(DenialReason.anonymous), trace: trace.lines };
    }

    const input = await this.inputOf(request, trace);
    const holding = this.policiesHolding(input, trace);

    if (holding.some((policy) => policy.effect === 'forbid')) {
      return { decision: deny(DenialReason.explicitDeny), trace: trace.lines };
    }

    return { decision: holding.length > 0 ? ALLOWED : deny(DenialReason.noMatchingPolicy), trace: trace.lines };
  }

  /** Every policy that bears on the permission is asked, one line each: a refusal says what each one answered. */
  private policiesHolding(input: PolicyInput, trace: Trace): readonly AttributePolicy[] {
    const bearing = this.options.policies.filter((policy) => coveringGrantOf(policy, input.permission) !== undefined);

    if (bearing.length === 0) {
      trace.no(`no policy bears on ${input.permission.id}`);

      return [];
    }

    return bearing.filter((policy) => {
      const text = `${policy.effect} ${policy.name}${coveringNote(policy, input.permission)}`;

      return policy.when(input)
        ? trace.yes(`${text} holds${policy.effect === 'forbid' ? ', and refuses' : ''}`)
        : trace.no(`${text} does not hold`);
    });
  }

  private async inputOf(request: CheckRequest, trace: Trace): Promise<PolicyInput> {
    const { resource } = request;
    const attributes = resource === undefined ? {} : await this.attributesOf(resource, trace);

    return {
      actor: request.actor,
      permission: request.permission,
      ...(resource === undefined ? {} : { resource }),
      attributes,
      context: request.context ?? {},
      now: this.options.clock.now(),
    };
  }

  /** What the port knows of the element, named by attribute, never by value. */
  private async attributesOf(resource: ResourceRef, trace: Trace): Promise<PolicyInput['attributes']> {
    const known = (await this.options.attributes?.of(resource)) ?? {};
    const names = Object.keys(known);
    const element = `${resource.type}:${resource.id}`;

    if (names.length === 0) {
      trace.no(`nothing is known of ${element}`);
    } else {
      trace.yes(`${element} is known by ${names.join(', ')}`);
    }

    return known;
  }
}

function coveringGrantOf(policy: AttributePolicy, permission: Permission): string | undefined {
  return policy.grants.find((pattern) => grantCovers(pattern, permission));
}

/** ` (billing:*)` when the policy bears on the permission through a wider grant; nothing when it names it. */
function coveringNote(policy: AttributePolicy, permission: Permission): string {
  const pattern = coveringGrantOf(policy, permission);

  return pattern === undefined || pattern === permission.id ? '' : ` (${pattern})`;
}
