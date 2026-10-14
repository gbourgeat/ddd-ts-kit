import { isAnonymous, type Actor, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
import type { Access } from '../authorization/access.js';
import type { AccessQuestion } from '../authorization/access-question.js';
import type { AccessScope } from '../authorization/access-scope.js';
import { recordAsked } from '../authorization/asked-permissions.js';
import type { Authorizer } from '../authorization/authorizer.js';
import type { CheckRequest } from '../authorization/check-request.js';
import { ALLOWED, deny, type Decision } from '../authorization/decision.js';
import { decisionRecordOf } from '../authorization/decision-record-of.js';
import { DenialReason } from '../authorization/denial-reason.js';
import { isResourceRef } from '../authorization/is-resource-ref.js';
import type { OnDecision } from '../authorization/on-decision.js';
import type { ResourceRef } from '../authorization/resource-ref.js';
import { workTenantOf } from '../authorization/work-tenant-of.js';
import { ForbiddenError } from '../errors/forbidden-error.js';
import { ListingNotSupportedError } from '../errors/listing-not-supported-error.js';
import { UnauthenticatedError } from '../errors/unauthenticated-error.js';
import type { Permission } from '../permissions/permission.js';
import type { Policy } from './policy.js';
import type { PolicyContext } from './policy-context.js';

export interface PolicyAccessOptions {
  /** Asked after the policies, with the resource the subject stands for. */
  readonly authorizer?: Authorizer;
  readonly policies?: readonly Policy<unknown>[];
  readonly clock: Clock;
  /** How a subject (an aggregate, a read model) names its resource. Default: a `ResourceRef` is itself. */
  readonly resourceOf?: (subject: unknown) => ResourceRef | undefined;
  readonly onDecision?: OnDecision;
  /** Gives the authorizer the tenant of the work (`workTenantId`); `authorizationModule` passes the one of the kernel. */
  readonly scope?: ExecutionScope;
}

/** No policy and no authorizer can answer for the permission: refused, as everything undeclared. */
export const NO_POLICY = 'NO_POLICY';

/** The `Access` of this package: every policy of the permission, then the authorizer, must allow. */
export class PolicyAccess implements Access {
  private readonly policiesByPermission = new Map<string, Policy<unknown>[]>();

  constructor(private readonly options: PolicyAccessOptions) {
    for (const policy of options.policies ?? []) {
      const sharing = this.policiesByPermission.get(policy.permission.id) ?? [];

      this.policiesByPermission.set(policy.permission.id, [...sharing, policy]);
    }
  }

  async authorize(actor: Actor, permission: Permission, subject: unknown): Promise<void> {
    const decision = await this.decide(actor, permission, subject);

    if (decision.allowed) {
      return;
    }

    throw isAnonymous(actor) ? new UnauthenticatedError() : new ForbiddenError(permission.id, decision.reason);
  }

  async decide(actor: Actor, permission: Permission, subject: unknown): Promise<Decision> {
    return this.decideOn({ actor, permission, subject });
  }

  async decideOn({ actor, permission, subject, context, recorded }: AccessQuestion): Promise<Decision> {
    recordAsked(permission);

    const resource = this.resourceOf(subject);
    const asked = { ...context, subject };

    const request = {
      actor,
      permission,
      ...(resource === undefined ? {} : { resource }),
      context: asked,
      ...workTenantOf(this.options.scope),
    };

    const decision = isAnonymous(actor) ? deny(DenialReason.anonymous) : await this.evaluate(request, subject);

    if (recorded !== false) {
      await this.options.onDecision?.(decisionRecordOf(request, decision));
    }

    return decision;
  }

  async scope(actor: Actor, permission: Permission, resourceType: string): Promise<AccessScope> {
    if (isAnonymous(actor)) {
      return { kind: 'none' };
    }

    const { authorizer } = this.options;

    if (authorizer?.listAccessible === undefined) {
      throw new ListingNotSupportedError();
    }

    return authorizer.listAccessible({ actor, permission, resourceType, ...workTenantOf(this.options.scope) });
  }

  private resourceOf(subject: unknown): ResourceRef | undefined {
    return (this.options.resourceOf ?? resourceRefOf)(subject);
  }

  private async evaluate(request: CheckRequest, subject: unknown): Promise<Decision> {
    const policies = this.policiesByPermission.get(request.permission.id) ?? [];
    const { authorizer, clock } = this.options;

    if (policies.length === 0 && authorizer === undefined) {
      return deny(NO_POLICY);
    }

    const context: PolicyContext = { now: clock.now() };

    for (const policy of policies) {
      const verdict = verdictOf(policy, { actor: request.actor, subject }, context);

      if (!verdict.allowed) {
        return verdict;
      }
    }

    return authorizer === undefined ? ALLOWED : authorizer.check(request);
  }
}

function resourceRefOf(subject: unknown): ResourceRef | undefined {
  return isResourceRef(subject) ? subject : undefined;
}

interface Asking {
  readonly actor: Actor;
  readonly subject: unknown;
}

function verdictOf(policy: Policy<unknown>, { actor, subject }: Asking, context: PolicyContext): Decision {
  if (policy.appliesTo !== undefined && !policy.appliesTo(subject)) {
    return deny(DenialReason.subjectMismatch);
  }

  const verdict = policy.allows(actor, subject, context);

  if (typeof verdict !== 'boolean') {
    return verdict;
  }

  return verdict ? ALLOWED : deny(policy.name);
}
