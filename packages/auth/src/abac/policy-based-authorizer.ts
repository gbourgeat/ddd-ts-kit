import { isAnonymous, type Clock } from '@ddd-ts-kit/kernel';
import type { Authorizer } from '../authorization/authorizer.js';
import type { CheckRequest } from '../authorization/check-request.js';
import { ALLOWED, deny, type Decision } from '../authorization/decision.js';
import { DenialReason } from '../authorization/denial-reason.js';
import { grantCovers } from '../permissions/grant-covers.js';
import type { AttributePolicy } from './attribute-policy.js';
import type { PolicyInput } from './policy-input.js';
import type { ResourceAttributes } from './resource-attributes.js';

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
    if (isAnonymous(request.actor)) {
      return deny(DenialReason.anonymous);
    }

    const input = await this.inputOf(request);

    const applying = this.options.policies.filter(
      (policy) => policy.grants.some((pattern) => grantCovers(pattern, request.permission)) && policy.when(input),
    );

    if (applying.some((policy) => policy.effect === 'forbid')) {
      return deny(DenialReason.explicitDeny);
    }

    return applying.length > 0 ? ALLOWED : deny(DenialReason.noMatchingPolicy);
  }

  private async inputOf(request: CheckRequest): Promise<PolicyInput> {
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
