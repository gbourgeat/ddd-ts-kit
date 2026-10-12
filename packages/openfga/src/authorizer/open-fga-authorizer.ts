import {
  ALLOWED,
  DenialReason,
  deny,
  type AccessScope,
  type Authorizer,
  type CheckRequest,
  type Decision,
  type ListRequest,
} from '@ddd-ts-kit/auth';
import { isAnonymous, type Actor } from '@ddd-ts-kit/kernel';
import type { OpenFgaAuthorizerOptions } from './open-fga-authorizer-options.js';

/**
 * The `Authorizer` port of `@ddd-ts-kit/auth` answered by OpenFGA: `Check` for a decision,
 * `ListObjects` for the scope of a search. The same permissions, mapping and denial codes as the
 * in-process `RelationBasedAuthorizer`, so a project moves from one to the other by binding.
 */
export class OpenFgaAuthorizer implements Authorizer {
  constructor(private readonly options: OpenFgaAuthorizerOptions) {}

  async check({ actor, permission, resource }: CheckRequest): Promise<Decision> {
    if (isAnonymous(actor)) {
      return deny(DenialReason.anonymous);
    }

    if (resource === undefined) {
      return deny(DenialReason.resourceRequired);
    }

    const relation = this.options.mapping[resource.type]?.[permission.id];

    if (relation === undefined) {
      return deny(DenialReason.unmappedPermission);
    }

    const object = `${resource.type}:${resource.id}`;
    const { allowed } = await this.options.client.check({ user: this.subjectOf(actor), relation, object });

    return allowed === true ? ALLOWED : deny(DenialReason.noRelation);
  }

  async listAccessible({ actor, permission, resourceType }: ListRequest): Promise<AccessScope> {
    const relation = this.options.mapping[resourceType]?.[permission.id];

    if (isAnonymous(actor) || relation === undefined) {
      return { kind: 'none' };
    }

    const { objects } = await this.options.client.listObjects({
      user: this.subjectOf(actor),
      relation,
      type: resourceType,
    });

    return { kind: 'ids', ids: objects.map((object) => object.slice(resourceType.length + 1)).sort() };
  }

  private subjectOf(actor: Actor): string {
    return this.options.subjectOf?.(actor) ?? `${actor.type}:${actor.id}`;
  }
}
