import { isAnonymous, type Actor } from '@ddd-ts-kit/kernel';
import {
  ALLOWED,
  DenialReason,
  deny,
  type AccessScope,
  type Authorizer,
  type CheckRequest,
  type Decision,
  type ListRequest,
} from '../authorizer.js';
import type { Permission } from '../permissions.js';
import { Evaluation, type ExpandNode } from './evaluation.js';
import { SchemaError, type Schema } from './schema.js';
import type { RelationTupleStore } from './store.js';
import { objectOf, parseObject } from './tuples.js';

/** Per resource type, the schema permission each kit permission stands for: `{ document: { 'docs:document.edit': 'edit' } }`. */
export type PermissionMapping = Readonly<Record<string, Readonly<Record<string, string>>>>;

export interface RelationBasedAuthorizerOptions {
  readonly schema: Schema;
  readonly store: RelationTupleStore;
  readonly mapping: PermissionMapping;
  /** How many `object#relation` hops one check may chain. Default 16. Beyond it the answer is no. */
  readonly maxDepth?: number;
  /** How many subjects a listing may walk through before giving up loudly. Default 10000. */
  readonly listLimit?: number;
  /** The subject an actor is in the tuples. Default `<actor type>:<actor id>`, such as `user:ada`. */
  readonly subjectOf?: (actor: Actor) => string;
}

/** A listing reached more subjects than `listLimit`: an incomplete list is never returned. */
export class ReverseExpansionLimitError extends Error {
  constructor(limit: number) {
    super(`The reverse expansion walked through more than ${limit} subjects. Narrow the model or delegate listing to a dedicated service.`);
    this.name = 'ReverseExpansionLimitError';
  }
}

const DEFAULT_MAX_DEPTH = 16;
const DEFAULT_LIST_LIMIT = 10_000;

/**
 * ReBAC in the manner of Zanzibar, evaluated in process: a permission holds when the rewrites
 * of the schema find a path of stored tuples from the object to the actor.
 */
export class RelationBasedAuthorizer implements Authorizer {
  constructor(private readonly options: RelationBasedAuthorizerOptions) {
    assertMappingResolves(options);
  }

  async check(request: CheckRequest): Promise<Decision> {
    if (isAnonymous(request.actor)) return deny(DenialReason.anonymous);
    if (request.resource === undefined) return deny(DenialReason.resourceRequired);
    const name = this.#mapped(request.resource.type, request.permission);
    if (name === undefined) return deny(DenialReason.unmappedPermission);
    const evaluation = this.#evaluation(request.actor, { exhaustive: false });
    const { allowed } = await evaluation.evaluate(objectOf(request.resource), name);
    if (evaluation.depthExceeded) return deny(DenialReason.depthExceeded);
    return allowed ? ALLOWED : deny(DenialReason.noRelation);
  }

  /**
   * By reverse expansion: walks every tuple reachable from the actor, then checks each object
   * of the type it met. Cost: one read per reachable subject and userset, plus one check per
   * candidate. Fine for thousands of tuples per actor, not for a search index.
   */
  async listAccessible({ actor, permission, resourceType }: ListRequest): Promise<AccessScope> {
    const name = this.#mapped(resourceType, permission);
    if (isAnonymous(actor) || name === undefined) return { kind: 'none' };
    const ids: string[] = [];
    for (const object of await this.#reachable(this.#subjectOf(actor), resourceType)) {
      const evaluation = this.#evaluation(actor, { exhaustive: false });
      const { allowed } = await evaluation.evaluate(object, name);
      if (allowed && !evaluation.depthExceeded) ids.push(parseObject(object).id);
    }
    return { kind: 'ids', ids: ids.sort() };
  }

  /** Why is this allowed, or not: the whole evaluation tree, every branch visited. For debugging. */
  async expand(request: Required<Pick<CheckRequest, 'actor' | 'permission' | 'resource'>>): Promise<ExpandNode> {
    const name = this.#mapped(request.resource.type, request.permission);
    if (name === undefined) {
      throw new SchemaError(`No schema permission is mapped to "${request.permission.id}" for "${request.resource.type}".`);
    }
    return this.#evaluation(request.actor, { exhaustive: true }).evaluate(objectOf(request.resource), name);
  }

  #mapped(resourceType: string, permission: Permission): string | undefined {
    return this.options.mapping[resourceType]?.[permission.id];
  }

  #evaluation(actor: Actor, { exhaustive }: { readonly exhaustive: boolean }): Evaluation {
    const { schema, store, maxDepth = DEFAULT_MAX_DEPTH } = this.options;
    return new Evaluation({ schema, store, subject: this.#subjectOf(actor), maxDepth, exhaustive });
  }

  #subjectOf(actor: Actor): string {
    return this.options.subjectOf?.(actor) ?? `${actor.type}:${actor.id}`;
  }

  async #reachable(subject: string, resourceType: string): Promise<readonly string[]> {
    const { store, listLimit = DEFAULT_LIST_LIMIT } = this.options;
    const seen = new Set([subject]);
    const candidates = new Set<string>();
    // A set also iterates over what is added while iterating: `seen` is the queue of the walk.
    for (const current of seen) {
      if (seen.size > listLimit) throw new ReverseExpansionLimitError(listLimit);
      for (const { object } of await store.readBySubject(current)) {
        if (parseObject(object).type === resourceType) candidates.add(object);
        for (const next of this.#subjectFormsOf(object)) seen.add(next);
      }
    }
    return [...candidates];
  }

  /** How an object may itself be the subject of a tuple: as such, or as one of its usersets. */
  #subjectFormsOf(object: string): readonly string[] {
    const { type } = parseObject(object);
    return [object, ...this.options.schema.usersetsOf(type).map((relation) => `${object}#${relation}`)];
  }
}

function assertMappingResolves({ schema, mapping }: RelationBasedAuthorizerOptions): void {
  for (const [type, names] of Object.entries(mapping)) {
    for (const [permissionId, name] of Object.entries(names)) {
      if (schema.resolve(type, name) !== undefined) continue;
      throw new SchemaError(`"${permissionId}" is mapped to "${type}#${name}", which the schema does not declare.`);
    }
  }
}
