import type { Schema } from '@ddd-ts-kit/auth/rebac';
import type {
  OpenFgaModel,
  OpenFgaRelationReference,
  OpenFgaTypeDefinition,
  OpenFgaUserset,
} from './open-fga-model.js';
import { usersetOf } from './userset-of.js';

/**
 * The authorization model of OpenFGA for a relationship schema: one source of truth, the schema
 * the project declares with `defineSchema`, from which the model is generated and checked
 * (`modelDrift`), never written by hand next to it. A relation of the schema is directly
 * assignable to the subjects it lists; a permission is the rewrite that derives it.
 */
export function authorizationModelOf(schema: Schema): OpenFgaModel {
  return { schema_version: '1.1', type_definitions: schema.types().map((type) => typeDefinitionOf(schema, type)) };
}

function typeDefinitionOf(schema: Schema, type: string): OpenFgaTypeDefinition {
  const relations = Object.entries(schema.relations(type));
  const permissions = Object.entries(schema.permissions(type));

  if (relations.length === 0 && permissions.length === 0) {
    return { type };
  }

  const direct = relations.map(([name]): [string, OpenFgaUserset] => [name, { this: {} }]);
  const derived = permissions.map(([name, rewrite]): [string, OpenFgaUserset] => [name, usersetOf(rewrite)]);

  const assignable = relations.map(([name, subjects]): [string, AssignableTo] => [
    name,
    { directly_related_user_types: subjects.map(referenceOf) },
  ]);

  return {
    type,
    relations: Object.fromEntries([...direct, ...derived]),
    metadata: { relations: Object.fromEntries(assignable) },
  };
}

interface AssignableTo {
  readonly directly_related_user_types: readonly OpenFgaRelationReference[];
}

/** `'group#member'` is the userset `{ type: 'group', relation: 'member' }`. */
function referenceOf(subject: string): OpenFgaRelationReference {
  const [type = subject, relation] = subject.split('#');

  return relation === undefined ? { type } : { type, relation };
}
