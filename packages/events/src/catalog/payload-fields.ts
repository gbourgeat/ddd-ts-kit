import { isRecord } from '../internal/json-schema/is-record.js';
import { localRefName } from '../internal/json-schema/local-ref-name.js';
import { splitDefinitions } from '../internal/json-schema/split-definitions.js';
import type { PayloadField } from './payload-field.js';

/**
 * Flattens the object properties of a JSON Schema: nested objects with dotted paths, one
 * level of arrays as `name[]`. Fields keep the order of the schema.
 */
export function payloadFields(jsonSchema: Record<string, unknown>): PayloadField[] {
  const { schema, definitions } = splitDefinitions(jsonSchema);

  return fieldsOf(schema, '', { definitions, insideArray: false, visiting: [] });
}

interface Walk {
  readonly definitions: Readonly<Record<string, unknown>>;
  readonly insideArray: boolean;
  /** Local definitions being expanded, to stop on a recursive schema. */
  readonly visiting: readonly string[];
}

function fieldsOf(node: unknown, prefix: string, walk: Walk): PayloadField[] {
  const resolved = resolve(node, walk);

  if (resolved === undefined || !isRecord(resolved.schema['properties'])) {
    return [];
  }

  const inner = resolved.walk;
  const required = Array.isArray(resolved.schema['required']) ? resolved.schema['required'] : [];

  return Object.entries(resolved.schema['properties']).flatMap(([name, property]) => {
    const target = resolve(property, inner)?.schema ?? {};

    const field = (path: string): PayloadField => ({
      path,
      type: typeLabel(property, inner),
      required: required.includes(name),
      description: describe(property, target),
    });

    if (target['type'] !== 'array') {
      return [field(prefix + name), ...fieldsOf(property, `${prefix}${name}.`, inner)];
    }

    const items = inner.insideArray
      ? []
      : fieldsOf(target['items'], `${prefix}${name}[].`, { ...inner, insideArray: true });

    return [field(`${prefix}${name}[]`), ...items];
  });
}

/** Follows local references and unwraps "X or null" down to the schema that has the shape. */
function resolve(
  node: unknown,
  walk: Walk,
): { readonly schema: Record<string, unknown>; readonly walk: Walk } | undefined {
  if (!isRecord(node)) {
    return undefined;
  }

  const name = localRefName(node['$ref']);

  if (name !== undefined) {
    if (walk.visiting.includes(name)) {
      return undefined;
    }

    return resolve(walk.definitions[name], { ...walk, visiting: [...walk.visiting, name] });
  }

  const meaningful = alternatives(node).filter(
    (alternative) => !isRecord(alternative) || alternative['type'] !== 'null',
  );

  if (meaningful.length === 1 && alternatives(node).length > 1) {
    return resolve(meaningful[0], walk);
  }

  return { schema: node, walk };
}

function alternatives(node: Record<string, unknown>): readonly unknown[] {
  const list = node['anyOf'] ?? node['oneOf'];

  return Array.isArray(list) ? list : [];
}

function typeLabel(node: unknown, walk: Walk): string {
  if (!isRecord(node)) {
    return 'any';
  }

  const name = localRefName(node['$ref']);

  if (name !== undefined) {
    return walk.visiting.includes(name)
      ? name
      : typeLabel(walk.definitions[name], { ...walk, visiting: [...walk.visiting, name] });
  }

  const literal = literalLabel(node);

  if (literal !== undefined) {
    return literal;
  }

  const options = alternatives(node);

  if (options.length > 0) {
    return [...new Set(options.map((option) => typeLabel(option, walk)))].join(' | ');
  }

  return declaredTypeLabel(node, walk);
}

function literalLabel(node: Record<string, unknown>): string | undefined {
  if ('const' in node) {
    return `const ${JSON.stringify(node['const'])}`;
  }

  if (Array.isArray(node['enum'])) {
    return `enum (${node['enum'].map((value) => JSON.stringify(value)).join(', ')})`;
  }

  return undefined;
}

function declaredTypeLabel(node: Record<string, unknown>, walk: Walk): string {
  const type = node['type'];

  if (Array.isArray(type)) {
    return type.map(String).join(' | ');
  }

  if (type === 'array') {
    return `array of ${typeLabel(node['items'], walk)}`;
  }

  if (typeof type !== 'string') {
    return 'any';
  }

  return typeof node['format'] === 'string' ? `${type} (${node['format']})` : type;
}

function describe(property: unknown, target: Record<string, unknown>): string {
  const own = isRecord(property) ? property['description'] : undefined;
  const description = own ?? target['description'];

  return typeof description === 'string' ? description : '';
}
