import { ReverseExpansionLimitError } from '@ddd-ts-kit/auth/rebac';
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

/** `OPENFGA_LIST_OBJECTS_MAX_RESULTS` of a server that leaves it at its default. */
const SERVER_LIST_OBJECTS_LIMIT = 1000;

/**
 * The `Authorizer` port of `@ddd-ts-kit/auth` answered by OpenFGA: `Check` for a decision,
 * `ListObjects` for the scope of a search. The same permissions, mapping and denial codes as the
 * in-process `RelationBasedAuthorizer`, so a project moves from one to the other by binding. Like
 * it, a listing that may be incomplete is refused: an answer as long as `listObjectsLimit` may
 * have been cut by the server, and a search narrowed by it would lose elements in silence.
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

    const limit = this.options.listObjectsLimit ?? SERVER_LIST_OBJECTS_LIMIT;

    if (objects.length >= limit) {
      throw new ReverseExpansionLimitError(limit);
    }

    return { kind: 'ids', ids: objects.map((object) => object.slice(resourceType.length + 1)).sort() };
  }

  private subjectOf(actor: Actor): string {
    return this.options.subjectOf?.(actor) ?? `${actor.type}:${actor.id}`;
  }
}
