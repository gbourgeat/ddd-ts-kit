import type { Schema } from '@ddd-ts-kit/auth/rebac';
import { OpenFgaModelError } from './open-fga-model-error';
import type {
  OpenFgaModel,
  OpenFgaRelationReference,
  OpenFgaTypeDefinition,
  OpenFgaUserset,
} from './open-fga-model';
import { relationNameOf } from './relation-name-of';
import { usersetOf } from './userset-of';

/**
 * The authorization model of OpenFGA for a relationship schema: one source of truth, the schema
 * the project declares with `defineSchema`, from which the model is generated and checked
 * (`modelDrift`), never written by hand next to it. A stored relation of the schema is directly
 * assignable to the subjects it lists; a derived relation is the rewrite that derives it, under
 * the name `relationNameOf` gives it.
 */
export function authorizationModelOf(schema: Schema): OpenFgaModel {
  return { schema_version: '1.1', type_definitions: schema.types().map((type) => typeDefinitionOf(schema, type)) };
}

function typeDefinitionOf(schema: Schema, type: string): OpenFgaTypeDefinition {
  const relations = Object.entries(schema.relations(type));
  const derived = Object.entries(schema.derived(type));

  if (relations.length === 0 && derived.length === 0) {
    return { type };
  }

  const stored = relations.map(([name]): [string, OpenFgaUserset] => [name, { this: {} }]);
  const rewritten = derived.map(([name, ways]): [string, OpenFgaUserset] => [relationNameOf(name), usersetOf(ways)]);

  assertDistinct(
    type,
    [...stored, ...rewritten].map(([name]) => name),
  );

  const assignable = relations.map(([name, subjects]): [string, AssignableTo] => [
    name,
    { directly_related_user_types: subjects.map(referenceOf) },
  ]);

  return {
    type,
    relations: Object.fromEntries([...stored, ...rewritten]),
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

function assertDistinct(type: string, names: readonly string[]): void {
  const twice = names.find((name, index) => names.indexOf(name) !== index);

  if (twice !== undefined) {
    throw new OpenFgaModelError(`"${type}" has two relations that OpenFGA would both call "${twice}".`);
  }
}
