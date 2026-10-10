import type { FromRewrite, Rewrite } from './rewrite.js';
import { Schema } from './schema.js';
import type { SchemaDefinition } from './schema-definition.js';
import { SchemaError } from './schema-error.js';

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
