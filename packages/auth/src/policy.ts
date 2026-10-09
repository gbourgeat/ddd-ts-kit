import { isAnonymous, type Actor, type Clock } from '@ddd-ts-kit/kernel';
import {
  ALLOWED,
  DenialReason,
  decisionRecord,
  deny,
  type AccessScope,
  type Authorizer,
  type CheckRequest,
  type Decision,
  type OnDecision,
  type ResourceRef,
} from './authorizer.js';
import { AuthorizationSetupError, ForbiddenError, ListingNotSupportedError, UnauthenticatedError } from './errors.js';
import type { Permission } from './permissions.js';

export interface PolicyContext {
  /** From the `Clock` port, so a rule about time is testable. */
  readonly now: Date;
}

/**
 * A named rule that needs loaded state: "only the author may edit, and not after publication".
 * `allows` is declared with method syntax on purpose: a method parameter is compared
 * bivariantly, so policies about different subjects can be listed together.
 */
export interface Policy<Subject> {
  /** Stable: it is the reason of the refusal when `allows` answers `false`. */
  readonly name: string;
  readonly permission: Permission;
  /** Tells whether a value is a subject of this policy; anything else is refused. */
  appliesTo?(subject: unknown): subject is Subject;
  allows(actor: Actor, subject: Subject, context: PolicyContext): boolean | Decision;
}

const POLICY_NAME_PATTERN = /^[a-z][a-z0-9]*([.-][a-z0-9]+)*$/;

/** Lives in `application/authorization/<name>.policy.ts`, with a spec of its own. */
export function definePolicy<Subject>(policy: Policy<Subject>): Policy<Subject> {
  if (!POLICY_NAME_PATTERN.test(policy.name)) {
    throw new AuthorizationSetupError(
      `"${policy.name}" is not a valid policy name: lower-case words separated by dots or dashes, as it becomes a reason code.`,
    );
  }
  return Object.freeze({ ...policy });
}

export interface AccessOptions {
  /** Asked after the policies, with the resource the subject stands for. */
  readonly authorizer?: Authorizer;
  readonly policies?: readonly Policy<unknown>[];
  readonly clock: Clock;
  /** How a subject (an aggregate, a read model) names its resource. Default: a `ResourceRef` is itself. */
  readonly resourceOf?: (subject: unknown) => ResourceRef | undefined;
  readonly onDecision?: OnDecision;
}

/** No policy and no authorizer can answer for the permission: refused, as everything undeclared. */
export const NO_POLICY = 'NO_POLICY';

/**
 * What a handler asks once it has loaded the element: every policy of the permission, then
 * the authorizer, must allow. `await this.access.authorize(command.actor, permissions.edit, article)`.
 */
export class Access {
  readonly #policies = new Map<string, Policy<unknown>[]>();

  constructor(private readonly options: AccessOptions) {
    for (const policy of options.policies ?? []) {
      this.#policies.set(policy.permission.id, [...(this.#policies.get(policy.permission.id) ?? []), policy]);
    }
  }

  /** Raises `ForbiddenError`, or `UnauthenticatedError` for the anonymous actor. */
  async authorize(actor: Actor, permission: Permission, subject: unknown): Promise<void> {
    const decision = await this.decide(actor, permission, subject);
    if (decision.allowed) return;
    throw isAnonymous(actor) ? new UnauthenticatedError() : new ForbiddenError(permission.id, decision.reason);
  }

  async decide(actor: Actor, permission: Permission, subject: unknown): Promise<Decision> {
    const resource = this.#resourceOf(subject);
    const request = { actor, permission, ...(resource === undefined ? {} : { resource }), context: { subject } };
    const decision = isAnonymous(actor) ? deny(DenialReason.anonymous) : await this.#evaluate(request, subject);
    await this.options.onDecision?.(decisionRecord(request, decision));
    return decision;
  }

  /** What the actor may list of one resource type, to hand to a read port. */
  async scope(actor: Actor, permission: Permission, resourceType: string): Promise<AccessScope> {
    if (isAnonymous(actor)) return { kind: 'none' };
    const { authorizer } = this.options;
    if (authorizer?.listAccessible === undefined) throw new ListingNotSupportedError();
    return authorizer.listAccessible({ actor, permission, resourceType });
  }

  #resourceOf(subject: unknown): ResourceRef | undefined {
    return (this.options.resourceOf ?? resourceRefOf)(subject);
  }

  async #evaluate(request: CheckRequest, subject: unknown): Promise<Decision> {
    const policies = this.#policies.get(request.permission.id) ?? [];
    const { authorizer, clock } = this.options;
    if (policies.length === 0 && authorizer === undefined) return deny(NO_POLICY);
    const context: PolicyContext = { now: clock.now() };
    for (const policy of policies) {
      const verdict = verdictOf(policy, { actor: request.actor, subject }, context);
      if (!verdict.allowed) return verdict;
    }
    return authorizer === undefined ? ALLOWED : authorizer.check(request);
  }
}

function resourceRefOf(subject: unknown): ResourceRef | undefined {
  return isResourceRef(subject) ? subject : undefined;
}

/** Strict on purpose: an aggregate that happens to have a `type` and an `id` is not a reference. */
export function isResourceRef(value: unknown): value is ResourceRef {
  if (typeof value !== 'object' || value === null || Object.keys(value).length !== 2) return false;
  if (!('type' in value) || !('id' in value)) return false;
  return typeof value.type === 'string' && typeof value.id === 'string';
}

interface Asking {
  readonly actor: Actor;
  readonly subject: unknown;
}

function verdictOf(policy: Policy<unknown>, { actor, subject }: Asking, context: PolicyContext): Decision {
  if (policy.appliesTo !== undefined && !policy.appliesTo(subject)) return deny(DenialReason.subjectMismatch);
  const verdict = policy.allows(actor, subject, context);
  if (typeof verdict !== 'boolean') return verdict;
  return verdict ? ALLOWED : deny(policy.name);
}
