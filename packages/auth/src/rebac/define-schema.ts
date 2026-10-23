import type { DerivedRelation } from './derived-relation';
import { Schema } from './schema';
import type { SchemaDefinition } from './schema-definition';
import { SchemaError } from './schema-error';
import type { Via, Way } from './via';
import { waysOf } from './ways-of';

/**
 * The types, their stored relations and the relations derived from them. Validated here, so an
 * unknown type or name, a derived relation with no way of being held, or one that could never
 * terminate, never reaches a check.
 */
export function defineSchema(definition: SchemaDefinition): Schema {
  const schema = new Schema(definition);

  for (const type of schema.types()) {
    assertNoNameClash(schema, type);
    assertSubjectsExist(schema, type);
    assertOneKindPerSubjectType(schema, type);

    for (const [name, derived] of Object.entries(schema.derived(type))) {
      assertHasWays({ type, name }, derived);
      assertWaysResolve(schema, { type, name }, derived);
      assertTerminates(schema, type, [name]);
    }
  }

  return schema;
}

interface Named {
  readonly type: string;
  readonly name: string;
}

function assertNoNameClash(schema: Schema, type: string): void {
  const relations = Object.keys(schema.relations(type));
  const clash = Object.keys(schema.derived(type)).find((name) => relations.includes(name));

  if (clash !== undefined) {
    throw new SchemaError(`"${type}" declares "${clash}" both as a relation and as a derived relation.`);
  }
}

function assertSubjectsExist(schema: Schema, type: string): void {
  for (const [name, subjects] of Object.entries(schema.relations(type))) {
    for (const subject of subjects) {
      const [subjectType = '', relation] = subject.split('#');

      if (!schema.types().includes(subjectType)) {
        throw new SchemaError(`"${type}#${name}" accepts the unknown type "${subjectType}".`);
      }

      if (relation !== undefined && !schema.declares(subjectType, relation)) {
        throw new SchemaError(`"${type}#${name}" accepts "${subject}", but "${subjectType}" has no "${relation}".`);
      }
    }
  }
}

/** A tuple names the element alone (`group:eng`): the relation has to say, once, what a group stands for there. */
function assertOneKindPerSubjectType(schema: Schema, type: string): void {
  for (const [name, subjects] of Object.entries(schema.relations(type))) {
    const seen = new Map<string, string>();

    for (const subject of subjects) {
      const subjectType = subject.split('#')[0] ?? subject;
      const other = seen.get(subjectType);

      if (other !== undefined && other !== subject) {
        throw new SchemaError(
          `"${type}#${name}" accepts both "${other}" and "${subject}": a tuple naming a ${subjectType} could not say which. Accept one of them.`,
        );
      }

      seen.set(subjectType, subject);
    }
  }
}

function assertHasWays(at: Named, derived: DerivedRelation): void {
  const { anyOf, allOf } = waysOf(derived);

  if (anyOf.length === 0 && allOf.length === 0) {
    throw new SchemaError(`"${at.type}#${at.name}" has no way of being held: give anyOf or allOf.`);
  }
}

function assertWaysResolve(schema: Schema, at: Named, derived: DerivedRelation): void {
  const { anyOf, allOf, butNot } = waysOf(derived);

  for (const way of [...anyOf, ...allOf, ...butNot]) {
    assertWayResolves(schema, at, way);
  }
}

function assertWayResolves(schema: Schema, at: Named, way: Way): void {
  if (typeof way !== 'string') {
    assertFollows(schema, at, way);

    return;
  }

  if (!schema.declares(at.type, way)) {
    throw new SchemaError(`"${at.type}#${at.name}" names "${way}", which "${at.type}" does not declare.`);
  }
}

function assertFollows(schema: Schema, at: Named, { via, holds }: Via): void {
  const followed = schema.relations(at.type)[via];

  if (followed === undefined) {
    throw new SchemaError(`"${at.type}#${at.name}" follows "${via}", which is not a relation of "${at.type}".`);
  }

  for (const target of followed) {
    if (target.includes('#')) {
      throw new SchemaError(
        `"${at.type}#${at.name}" follows "${via}", which accepts "${target}": only elements can be followed.`,
      );
    }

    if (!schema.declares(target, holds)) {
      throw new SchemaError(`"${at.type}#${at.name}" asks "${holds}" of "${target}", which does not declare it.`);
    }
  }
}

/**
 * A derived relation defined through names alone (`edit: 'view'`, `view: 'edit'`) reads no
 * tuple and would loop for ever. A loop through `via` or a userset reads a tuple at each turn:
 * it depends on the data and is cut at run time by the cycle protection.
 */
function assertTerminates(schema: Schema, type: string, path: readonly string[]): void {
  const derived = schema.derived(type)[path.at(-1) ?? ''];

  if (derived === undefined) {
    return;
  }

  for (const name of namesIn(derived)) {
    if (path.includes(name)) {
      throw new SchemaError(`"${type}" has a derived relation that cannot terminate: ${[...path, name].join(' -> ')}.`);
    }

    assertTerminates(schema, type, [...path, name]);
  }
}

function namesIn(derived: DerivedRelation): readonly string[] {
  const { anyOf, allOf, butNot } = waysOf(derived);

  return [...anyOf, ...allOf, ...butNot].filter((way): way is string => typeof way === 'string');
}
