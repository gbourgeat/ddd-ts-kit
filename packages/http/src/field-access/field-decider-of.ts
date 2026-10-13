import type { Actor, Clock } from '@ddd-ts-kit/kernel';
import type { FieldDecider } from './field-decider.js';
import type { FieldPolicy } from './field-policy.js';

/** What the decider asks of the `Access` port of `@ddd-ts-kit/auth`, which fits as it is. */
export interface FieldAccessDecisions {
  decide(actor: Actor, permission: { readonly id: string }, subject: unknown): Promise<{ readonly allowed: boolean }>;
}

export interface FieldDeciderOptions {
  /** The `Access` of the application: a permission of a field is decided as the permission of a use case, its policies and its authorizer. */
  readonly access: FieldAccessDecisions;
  /** What a policy of a field is told the time with. */
  readonly clock: Clock;
}

/**
 * The decider of the field rules from the `Access` of the application:
 * `fieldAccess: fieldDeciderOf({ access: app.resolve(Access), clock })`. A permission is asked
 * of `access.decide`, which runs the policies of the permission then the authorizer, and records
 * the decision as any other; a policy named on the field is asked directly.
 */
export function fieldDeciderOf({ access, clock }: FieldDeciderOptions): FieldDecider {
  return async (actor, requirement, subject) => {
    if ('permission' in requirement) {
      return (await access.decide(actor, requirement.permission, subject)).allowed;
    }

    return policyAllows(requirement.policy, { actor, subject, now: clock.now() });
  };
}

interface Asking {
  readonly actor: Actor;
  readonly subject: unknown;
  readonly now: Date;
}

function policyAllows(policy: FieldPolicy, { actor, subject, now }: Asking): boolean {
  if (policy.appliesTo !== undefined && !policy.appliesTo(subject)) {
    return false;
  }

  const verdict = policy.allows(actor, subject, { now });

  return typeof verdict === 'boolean' ? verdict : verdict.allowed;
}
