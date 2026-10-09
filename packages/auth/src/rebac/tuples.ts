import type { ResourceRef } from '../authorizer.js';

/**
 * One fact: `subject` has `relation` to `object`. Written `object#relation@subject` in the
 * Zanzibar paper: `document:1#editor@user:ada`, `document:1#editor@group:eng#member`.
 */
export interface RelationTuple {
  /** Such as `document:1`: the type, a colon, the id. */
  readonly object: string;
  readonly relation: string;
  /** `<type>:<id>`, or the userset `<type>:<id>#<relation>`: everybody having that relation. */
  readonly subject: string;
}

export interface SubjectRef extends ResourceRef {
  /** Present for a userset. */
  readonly relation?: string;
}

/** A tuple that cannot be read or that the schema does not allow. */
export class InvalidTupleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTupleError';
  }
}

const OBJECT_PATTERN = /^([a-z][a-z0-9_-]*):([^#@\s]+)$/;
const NAME_PATTERN = /^[a-z][a-z0-9_-]*$/;

export function objectOf(resource: ResourceRef): string {
  return `${resource.type}:${resource.id}`;
}

export function parseObject(object: string): ResourceRef {
  const [, type, id] = OBJECT_PATTERN.exec(object) ?? [];
  if (type === undefined || id === undefined) {
    throw new InvalidTupleError(`"${object}" is not an object: expected <type>:<id>.`);
  }
  return { type, id };
}

export function parseSubject(subject: string): SubjectRef {
  const [object = '', relation, ...rest] = subject.split('#');
  if (rest.length > 0 || (relation !== undefined && !NAME_PATTERN.test(relation))) {
    throw new InvalidTupleError(`"${subject}" is not a subject: expected <type>:<id> or <type>:<id>#<relation>.`);
  }
  return relation === undefined ? parseObject(object) : { ...parseObject(object), relation };
}

export function tupleKey(tuple: RelationTuple): string {
  return `${tuple.object}#${tuple.relation}@${tuple.subject}`;
}
