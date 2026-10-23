import type { DerivedRelation } from './derived-relation';
import { InvalidTupleError } from './invalid-tuple-error';
import { parseObject } from './parse-object';
import type { RelationTuple } from './relation-tuple';
import type { SchemaDefinition } from './schema-definition';

/** The types, their stored relations and their derived relations. Built by `defineSchema`. */
export class Schema {
  constructor(private readonly definition: SchemaDefinition) {}

  types(): readonly string[] {
    return Object.keys(this.definition);
  }

  relations(type: string): Readonly<Record<string, readonly string[]>> {
    return this.definition[type]?.relations ?? {};
  }

  derived(type: string): Readonly<Record<string, DerivedRelation>> {
    return this.definition[type]?.derived ?? {};
  }

  /** Whether `name` is a relation or a derived relation of `type`. */
  declares(type: string, name: string): boolean {
    return this.relations(type)[name] !== undefined || this.derived(type)[name] !== undefined;
  }

  /**
   * How `relation` of `type` accepts a subject of `subjectType`: as the element itself
   * (`'folder'`), as what it stands for (`'group#member'`), or not at all.
   */
  acceptedKindOf(type: string, relation: string, subjectType: string): string | undefined {
    const accepted = this.relations(type)[relation] ?? [];

    return accepted.find((kind) => kind === subjectType || kind.startsWith(`${subjectType}#`));
  }

  /** What a subject of `subjectType` stands for in `relation` of `type`: `'member'` for `group#member`; undefined for the element itself. */
  standsFor(type: string, relation: string, subjectType: string): string | undefined {
    const kind = this.acceptedKindOf(type, relation, subjectType);
    const separator = kind?.indexOf('#') ?? -1;

    return kind === undefined || separator === -1 ? undefined : kind.slice(separator + 1);
  }

  /** Refuses a tuple the schema does not describe, before it is stored. */
  assertWritable(tuple: RelationTuple): void {
    const { type } = parseObject(tuple.object);

    if (this.relations(type)[tuple.relation] === undefined) {
      throw new InvalidTupleError(`"${tuple.relation}" is not a relation of "${type}": only relations are written.`);
    }

    if (tuple.subject.includes('#')) {
      throw new InvalidTupleError(
        `"${tuple.subject}" is not a subject: name the element, "${tuple.subject.split('#')[0]}", and let the schema say what it stands for.`,
      );
    }

    const subjectType = parseObject(tuple.subject).type;

    if (this.acceptedKindOf(type, tuple.relation, subjectType) === undefined) {
      throw new InvalidTupleError(`"${type}#${tuple.relation}" does not accept a subject of type "${subjectType}".`);
    }
  }
}
