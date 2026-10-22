import type { Actor, Clock } from '@ddd-ts-kit/kernel';
import type { FieldDecider } from './field-decider';
import type { FieldPolicy } from './field-policy';
import type { FieldQuestion } from './field-question';

interface Decided {
  readonly allowed: boolean;
}

/** What the decider asks of the `Access` port of `@ddd-ts-kit/auth`, which fits as it is. */
export interface FieldAccessDecisions {
  decide(actor: Actor, permission: { readonly id: string }, subject: unknown): Promise<Decided>;

  /** Preferred when present (the `PolicyAccess` of `@ddd-ts-kit/auth` has it): it takes the context, and records only an act. */
  decideOn?(question: {
    readonly actor: Actor;
    readonly permission: { readonly id: string };
    readonly subject?: unknown;
    readonly context?: Readonly<Record<string, unknown>>;
    readonly recorded?: boolean;
  }): Promise<Decided>;
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
 * of `access.decideOn` (else `decide`), which runs the policies of the permission then the
 * authorizer; the decision is recorded only for an act (a field set, a form opened), never for a
 * field shown or left out. A policy named on the field is asked directly.
 */
export function fieldDeciderOf({ access, clock }: FieldDeciderOptions): FieldDecider {
  return async (question) => {
    const { actor, requirement, subject } = question;

    if ('permission' in requirement) {
      return (await decisionOf(access, question, requirement.permission)).allowed;
    }

    return policyAllows(requirement.policy, { actor, subject, now: clock.now() });
  };
}

function decisionOf(
  access: FieldAccessDecisions,
  { actor, subject, context, recorded }: FieldQuestion,
  permission: { readonly id: string },
): Promise<Decided> {
  if (access.decideOn === undefined) {
    return access.decide(actor, permission, subject);
  }

  return access.decideOn({ actor, permission, subject, recorded, ...(context === undefined ? {} : { context }) });
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
