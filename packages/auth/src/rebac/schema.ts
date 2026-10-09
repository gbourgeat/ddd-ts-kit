import { InvalidTupleError, parseObject, parseSubject, type RelationTuple } from './tuples.js';

export interface SetRewrite {
  readonly kind: 'union' | 'intersection';
  readonly children: readonly Rewrite[];
}

export interface ExclusionRewrite {
  readonly kind: 'exclusion';
  readonly base: Rewrite;
  readonly subtract: Rewrite;
}

/** Tuple to userset: follow `relation` to other objects and ask `permission` there. */
export interface FromRewrite {
  readonly kind: 'from';
  readonly relation: string;
  readonly permission: string;
}

/** A name alone is a computed userset: another relation or permission of the same object. */
export type Rewrite = string | SetRewrite | ExclusionRewrite | FromRewrite;

export function union(...children: readonly Rewrite[]): SetRewrite {
  return { kind: 'union', children };
}

export function intersection(...children: readonly Rewrite[]): SetRewrite {
  return { kind: 'intersection', children };
}

/** Everybody in `base` who is not in `subtract`. */
export function exclusion(base: Rewrite, subtract: Rewrite): ExclusionRewrite {
  return { kind: 'exclusion', base, subtract };
}

/** `from('parent', 'edit')`: whoever may edit the parent. */
export function from(relation: string, permission: string): FromRewrite {
  return { kind: 'from', relation, permission };
}

export interface TypeDefinition {
  /** For each relation, who may be its subject: `'user'`, or the userset `'group#member'`. */
  readonly relations?: Readonly<Record<string, readonly string[]>>;
  readonly permissions?: Readonly<Record<string, Rewrite>>;
}

export type SchemaDefinition = Readonly<Record<string, TypeDefinition>>;

export type Resolution =
  | { readonly kind: 'relation'; readonly subjects: readonly string[] }
  | { readonly kind: 'permission'; readonly rewrite: Rewrite };

/** A schema that contradicts itself, found when it is defined. */
export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaError';
  }
}

/**
 * The object types, their relations and how permissions derive from them. Validated here, so
 * an unknown type or relation, or a rewrite that could never terminate, never reaches a check.
 */
export function defineSchema(definition: SchemaDefinition): Schema {
  const schema = new Schema(definition);
  for (const type of schema.types()) {
    assertNoNameClash(schema, type);
    assertSubjectsExist(schema, type);
    for (const [name, rewrite] of Object.entries(schema.permissions(type))) {
      assertResolves(schema, { type, name }, rewrite);
      assertTerminates(schema, type, [name]);
    }
  }
  return schema;
}

export class Schema {
  constructor(private readonly definition: SchemaDefinition) {}

  types(): readonly string[] {
    return Object.keys(this.definition);
  }

  relations(type: string): Readonly<Record<string, readonly string[]>> {
    return this.definition[type]?.relations ?? {};
  }

  permissions(type: string): Readonly<Record<string, Rewrite>> {
    return this.definition[type]?.permissions ?? {};
  }

  resolve(type: string, name: string): Resolution | undefined {
    const subjects = this.relations(type)[name];
    if (subjects !== undefined) return { kind: 'relation', subjects };
    const rewrite = this.permissions(type)[name];
    return rewrite === undefined ? undefined : { kind: 'permission', rewrite };
  }

  /** The names of `type` that some relation accepts as a userset, such as `member` of a group. */
  usersetsOf(type: string): readonly string[] {
    const accepted = this.types()
      .flatMap((other) => Object.values(this.relations(other)).flat())
      .filter((subject) => subject.startsWith(`${type}#`))
      .map((subject) => subject.slice(type.length + 1));
    return [...new Set(accepted)];
  }

  /** Refuses a tuple the schema does not describe, before it is stored. */
  assertWritable(tuple: RelationTuple): void {
    const { type } = parseObject(tuple.object);
    const resolution = this.resolve(type, tuple.relation);
    if (resolution?.kind !== 'relation') {
      throw new InvalidTupleError(`"${tuple.relation}" is not a relation of "${type}": only relations are written.`);
    }
    const subject = parseSubject(tuple.subject);
    const kind = subject.relation === undefined ? subject.type : `${subject.type}#${subject.relation}`;
    if (!resolution.subjects.includes(kind)) {
      throw new InvalidTupleError(`"${type}#${tuple.relation}" does not accept a subject of kind "${kind}".`);
    }
  }
}

function assertNoNameClash(schema: Schema, type: string): void {
  const relations = Object.keys(schema.relations(type));
  const clash = Object.keys(schema.permissions(type)).find((name) => relations.includes(name));
  if (clash !== undefined) {
    throw new SchemaError(`"${type}" declares "${clash}" both as a relation and as a permission.`);
  }
}

function assertSubjectsExist(schema: Schema, type: string): void {
  for (const [name, subjects] of Object.entries(schema.relations(type))) {
    for (const subject of subjects) {
      const [subjectType = '', relation] = subject.split('#');
      if (!schema.types().includes(subjectType)) {
        throw new SchemaError(`"${type}#${name}" accepts the unknown type "${subjectType}".`);
      }
      if (relation !== undefined && schema.resolve(subjectType, relation) === undefined) {
        throw new SchemaError(`"${type}#${name}" accepts "${subject}", but "${subjectType}" has no "${relation}".`);
      }
    }
  }
}

interface Named {
  readonly type: string;
  readonly name: string;
}

function assertResolves(schema: Schema, at: Named, rewrite: Rewrite): void {
  if (typeof rewrite === 'string') {
    if (schema.resolve(at.type, rewrite) !== undefined) return;
    throw new SchemaError(`"${at.type}#${at.name}" refers to "${rewrite}", which "${at.type}" does not declare.`);
  }
  if (rewrite.kind === 'from') {
    assertFollows(schema, at, rewrite);
    return;
  }
  const children = rewrite.kind === 'exclusion' ? [rewrite.base, rewrite.subtract] : rewrite.children;
  if (children.length === 0) throw new SchemaError(`"${at.type}#${at.name}" has an empty ${rewrite.kind}.`);
  for (const child of children) assertResolves(schema, at, child);
}

function assertFollows(schema: Schema, at: Named, { relation, permission }: FromRewrite): void {
  const followed = schema.resolve(at.type, relation);
  if (followed?.kind !== 'relation') {
    throw new SchemaError(`"${at.type}#${at.name}" follows "${relation}", which is not a relation of "${at.type}".`);
  }
  for (const target of followed.subjects) {
    if (target.includes('#')) {
      throw new SchemaError(`"${at.type}#${at.name}" follows "${relation}", which accepts the userset "${target}": only objects can be followed.`);
    }
    if (schema.resolve(target, permission) === undefined) {
      throw new SchemaError(`"${at.type}#${at.name}" asks "${permission}" of "${target}", which does not declare it.`);
    }
  }
}

/**
 * A permission defined by itself through names alone (`edit: 'view'`, `view: 'edit'`) reads
 * no tuple and would loop for ever. A loop through `from` or a userset reads a tuple at each
 * turn: it depends on the data and is cut at run time by the cycle protection.
 */
function assertTerminates(schema: Schema, type: string, path: readonly string[]): void {
  const rewrite = schema.permissions(type)[path.at(-1) ?? ''];
  if (rewrite === undefined) return;
  for (const name of namesIn(rewrite)) {
    if (path.includes(name)) {
      throw new SchemaError(`"${type}" has a rewrite that cannot terminate: ${[...path, name].join(' -> ')}.`);
    }
    assertTerminates(schema, type, [...path, name]);
  }
}

function namesIn(rewrite: Rewrite): readonly string[] {
  if (typeof rewrite === 'string') return [rewrite];
  if (rewrite.kind === 'from') return [];
  const children = rewrite.kind === 'exclusion' ? [rewrite.base, rewrite.subtract] : rewrite.children;
  return children.flatMap(namesIn);
}
