import type { ExpandNode } from './expand-node.js';
import { parseObject } from './parse-object.js';
import type { RelationTuple } from './relation-tuple.js';
import type { RelationTupleStore } from './relation-tuple-store.js';
import type { ExclusionRewrite, FromRewrite, Rewrite, SetRewrite } from './rewrite.js';
import type { Schema } from './schema.js';

export interface EvaluationOptions {
  readonly schema: Schema;
  readonly store: RelationTupleStore;
  /** `<type>:<id>` of who is asking. */
  readonly subject: string;
  readonly maxDepth: number;
  /** Visits every branch instead of stopping at the first that settles the answer. */
  readonly exhaustive: boolean;
}

interface Position {
  readonly object: string;
  readonly relation: string;
  /** The `object#relation` pairs being evaluated above this one. */
  readonly path: readonly string[];
}

type Step = () => Promise<ExpandNode>;

/** One question, answered by walking the rewrites of the schema over the stored tuples. */
export class Evaluation {
  private cutByDepthLimit = false;

  constructor(private readonly options: EvaluationOptions) {}

  /** True when a branch was cut by the depth limit: the answer is then not to be trusted. */
  get depthExceeded(): boolean {
    return this.cutByDepthLimit;
  }

  async evaluate(object: string, relation: string, path: readonly string[] = []): Promise<ExpandNode> {
    const key = `${object}#${relation}`;
    const here: Position = { object, relation, path: [...path, key] };

    if (path.includes(key)) return node(here, { via: 'cycle', allowed: false });

    if (path.length >= this.options.maxDepth) {
      this.cutByDepthLimit = true;

      return node(here, { via: 'depth-limit', allowed: false });
    }

    const resolution = this.options.schema.resolve(parseObject(object).type, relation);

    if (resolution === undefined) return node(here, { via: 'unknown', allowed: false });

    return resolution.kind === 'relation' ? this.relation(here) : this.rewrite(here, resolution.rewrite);
  }

  private async relation(here: Position): Promise<ExpandNode> {
    const tuples = await this.options.store.readByObject(here.object, here.relation);
    const children = await this.until(true, tuples.map((tuple) => () => this.tuple(here, tuple)));

    return node(here, { via: 'relation', allowed: children.some(isAllowed), children });
  }

  /** Runs the steps in order and stops at the first whose answer is `settling`, unless exhaustive. */
  private async until(settling: boolean, steps: readonly Step[]): Promise<ExpandNode[]> {
    const visited: ExpandNode[] = [];

    for (const step of steps) {
      const outcome = await step();

      visited.push(outcome);

      if (!this.options.exhaustive && outcome.allowed === settling) break;
    }

    return visited;
  }

  private async tuple(here: Position, tuple: RelationTuple): Promise<ExpandNode> {
    const [object = '', relation] = tuple.subject.split('#');

    if (relation === undefined) {
      return node(here, { via: 'direct', allowed: tuple.subject === this.options.subject, tuple });
    }

    const members = await this.evaluate(object, relation, here.path);

    return node(here, { via: 'userset', allowed: members.allowed, children: [members], tuple });
  }

  private rewrite(here: Position, rewrite: Rewrite): Promise<ExpandNode> {
    if (typeof rewrite === 'string') return this.computed(here, rewrite);

    if (rewrite.kind === 'from') return this.from(here, rewrite);

    return rewrite.kind === 'exclusion' ? this.exclusion(here, rewrite) : this.set(here, rewrite);
  }

  private async computed(here: Position, name: string): Promise<ExpandNode> {
    const child = await this.evaluate(here.object, name, here.path);

    return node(here, { via: 'computed', allowed: child.allowed, children: [child] });
  }

  private async from(here: Position, { relation, permission }: FromRewrite): Promise<ExpandNode> {
    const tuples = await this.options.store.readByObject(here.object, relation);
    const followed = tuples.filter((tuple) => !tuple.subject.includes('#'));

    const children = await this.until(
      true,
      followed.map((tuple) => async () => ({ ...(await this.evaluate(tuple.subject, permission, here.path)), tuple })),
    );

    return node(here, { via: 'from', allowed: children.some(isAllowed), children });
  }

  private async exclusion(here: Position, { base, subtract }: ExclusionRewrite): Promise<ExpandNode> {
    const kept = await this.rewrite(here, base);

    if (!kept.allowed && !this.options.exhaustive) {
      return node(here, { via: 'exclusion', allowed: false, children: [kept] });
    }

    const removed = await this.rewrite(here, subtract);

    return node(here, { via: 'exclusion', allowed: kept.allowed && !removed.allowed, children: [kept, removed] });
  }

  private async set(here: Position, { kind, children }: SetRewrite): Promise<ExpandNode> {
    const settles = kind === 'union';
    const visited = await this.until(settles, children.map((child) => () => this.rewrite(here, child)));
    const allowed = settles ? visited.some(isAllowed) : visited.every(isAllowed);

    return node(here, { via: kind, allowed, children: visited });
  }
}

type Outcome = Pick<ExpandNode, 'via' | 'allowed'> & Partial<Pick<ExpandNode, 'children' | 'tuple'>>;

function node({ object, relation }: Position, outcome: Outcome): ExpandNode {
  return { object, relation, children: [], ...outcome };
}

function isAllowed(outcome: ExpandNode): boolean {
  return outcome.allowed;
}
