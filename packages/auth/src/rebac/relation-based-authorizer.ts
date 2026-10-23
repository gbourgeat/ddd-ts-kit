import { isAnonymous, type Actor } from '@ddd-ts-kit/kernel';
import type { AccessScope } from '../authorization/access-scope';
import type { Authorizer } from '../authorization/authorizer';
import type { CheckRequest } from '../authorization/check-request';
import { ALLOWED, deny, type Decision } from '../authorization/decision';
import { DenialReason } from '../authorization/denial-reason';
import type { ListRequest } from '../authorization/list-request';
import type { Explanation } from '../authorization/explanation';
import { objectOf } from './object-of';
import { parseObject } from './parse-object';
import { Question, type QuestionOptions } from './question';
import type { RelationTupleStore } from './relation-tuple-store';
import { ReverseExpansionLimitError } from './reverse-expansion-limit-error';
import type { Schema } from './schema';

export interface RelationBasedAuthorizerOptions {
  readonly schema: Schema;
  readonly store: RelationTupleStore;
  /** How many `element relation` questions one check may chain. Default 16. Beyond it the answer is no. */
  readonly maxDepth?: number;
  /** How many subjects a listing may walk through before giving up loudly. Default 10000. */
  readonly listLimit?: number;
  /** The subject an actor is in the tuples. Default `<actor type>:<actor id>`, such as `user:ada`. */
  readonly subjectOf?: (actor: Actor) => string;
}

const DEFAULT_MAX_DEPTH = 16;
const DEFAULT_LIST_LIMIT = 10_000;
const NO_TRACE: Explanation['trace'] = [];

/**
 * ReBAC in the manner of Zanzibar, evaluated in process: a permission holds on an element when
 * the actor holds the derived relation named after it, by a path of stored tuples.
 */
export class RelationBasedAuthorizer implements Authorizer {
  constructor(private readonly options: RelationBasedAuthorizerOptions) {}

  async check(request: CheckRequest): Promise<Decision> {
    return (await this.decide(request, 'first-way')).decision;
  }

  /** Why is this allowed, or not: the decision and every question asked, every way visited. For debugging. */
  explain(request: CheckRequest): Promise<Explanation> {
    return this.decide(request, 'every-way');
  }

  /**
   * By reverse expansion: walks every tuple reachable from the actor, then checks each element
   * of the type it met. Cost: one read per reachable subject, plus one check per candidate.
   * Fine for thousands of tuples per actor, not for a search index.
   */
  async listAccessible({ actor, permission, resourceType }: ListRequest): Promise<AccessScope> {
    if (isAnonymous(actor) || !this.grants(resourceType, permission.id)) {
      return { kind: 'none' };
    }

    const ids: string[] = [];

    for (const element of await this.reachable(this.subjectOf(actor), resourceType)) {
      const question = this.question(actor, 'first-way');

      if ((await question.holds(element, permission.id)) && !question.depthExceeded) {
        ids.push(parseObject(element).id);
      }
    }

    return { kind: 'ids', ids: ids.sort() };
  }

  private async decide(request: CheckRequest, visit: QuestionOptions['visit']): Promise<Explanation> {
    if (isAnonymous(request.actor)) {
      return { decision: deny(DenialReason.anonymous), trace: NO_TRACE };
    }

    if (request.resource === undefined) {
      return { decision: deny(DenialReason.resourceRequired), trace: NO_TRACE };
    }

    if (!this.grants(request.resource.type, request.permission.id)) {
      return { decision: deny(DenialReason.unmappedPermission), trace: NO_TRACE };
    }

    const question = this.question(request.actor, visit);
    const holds = await question.holds(objectOf(request.resource), request.permission.id);

    if (question.depthExceeded) {
      return { decision: deny(DenialReason.depthExceeded), trace: question.trace };
    }

    return { decision: holds ? ALLOWED : deny(DenialReason.noRelation), trace: question.trace };
  }

  /** Whether the type derives a relation named after the permission. */
  private grants(resourceType: string, permissionId: string): boolean {
    return this.options.schema.derived(resourceType)[permissionId] !== undefined;
  }

  private question(actor: Actor, visit: QuestionOptions['visit']): Question {
    const { schema, store, maxDepth = DEFAULT_MAX_DEPTH } = this.options;

    return new Question({ schema, store, subject: this.subjectOf(actor), maxDepth, visit });
  }

  private subjectOf(actor: Actor): string {
    return this.options.subjectOf?.(actor) ?? `${actor.type}:${actor.id}`;
  }

  /** Breadth first from the actor: every element the actor is something of, then every element those are something of. */
  private async reachable(start: string, resourceType: string): Promise<readonly string[]> {
    const { store, listLimit = DEFAULT_LIST_LIMIT } = this.options;
    const seen = new Set([start]);
    const queue = [start];
    const candidates = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift() ?? '';

      for (const { object } of await store.readBySubject(current)) {
        if (parseObject(object).type === resourceType) {
          candidates.add(object);
        }

        if (!seen.has(object)) {
          seen.add(object);
          queue.push(object);
        }

        if (seen.size > listLimit) {
          throw new ReverseExpansionLimitError(listLimit);
        }
      }
    }

    return [...candidates];
  }
}
