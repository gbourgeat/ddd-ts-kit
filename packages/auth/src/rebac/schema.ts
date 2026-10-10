import { InvalidTupleError } from './invalid-tuple-error.js';
import { parseObject } from './parse-object.js';
import { parseSubject } from './parse-subject.js';
import type { RelationTuple } from './relation-tuple.js';
import type { Resolution } from './resolution.js';
import type { Rewrite } from './rewrite.js';
import type { SchemaDefinition } from './schema-definition.js';

/** The object types, their relations and how permissions derive from them. Built by `defineSchema`. */
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
