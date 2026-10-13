/**
 * A model reduced to what decides a check: per `type#relation`, its rewrite and the subjects it
 * accepts, as stable text. What a server adds (ids, source positions, empty fields) is left
 * out, so a model read back compares equal to the one written.
 */
export function canonicalModel(model: unknown): ReadonlyMap<string, string> {
  const entries = new Map<string, string>();

  for (const definition of listOf(fieldOf(model, 'type_definitions'))) {
    const type = String(fieldOf(definition, 'type'));
    const relations = recordOf(fieldOf(definition, 'relations'));
    const metadata = recordOf(fieldOf(fieldOf(definition, 'metadata'), 'relations'));

    entries.set(type, 'type');

    for (const [relation, userset] of Object.entries(relations)) {
      const accepted = listOf(fieldOf(metadata[relation], 'directly_related_user_types')).map(referenceText).sort();

      entries.set(`${type}#${relation}`, `${usersetText(userset)} [${accepted.join(', ')}]`);
    }
  }

  return entries;
}

function usersetText(userset: unknown): string {
  const union = fieldOf(userset, 'union');
  const intersection = fieldOf(userset, 'intersection');
  const difference = fieldOf(userset, 'difference');
  const tupleToUserset = fieldOf(userset, 'tupleToUserset');

  if (union !== undefined) {
    return `union(${listOf(fieldOf(union, 'child')).map(usersetText).join(', ')})`;
  }

  if (intersection !== undefined) {
    return `intersection(${listOf(fieldOf(intersection, 'child')).map(usersetText).join(', ')})`;
  }

  if (difference !== undefined) {
    return `difference(${usersetText(fieldOf(difference, 'base'))}, ${usersetText(fieldOf(difference, 'subtract'))})`;
  }

  if (tupleToUserset !== undefined) {
    const followed = relationOf(fieldOf(tupleToUserset, 'tupleset'));

    return `from(${followed}, ${relationOf(fieldOf(tupleToUserset, 'computedUserset'))})`;
  }

  const computed = fieldOf(userset, 'computedUserset');

  return computed === undefined ? 'this' : relationOf(computed);
}

function referenceText(reference: unknown): string {
  const relation = fieldOf(reference, 'relation');

  return `${String(fieldOf(reference, 'type'))}${typeof relation === 'string' && relation !== '' ? `#${relation}` : ''}`;
}

function relationOf(value: unknown): string {
  return String(fieldOf(value, 'relation'));
}

function fieldOf(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
}

function listOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function recordOf(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null ? { ...value } : {};
}
