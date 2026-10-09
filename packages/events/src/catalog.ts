import type { AnyIntegrationEventDefinition } from './definition.js';
import type { EventRegistry } from './registry.js';
import { compareText, isRecord, localRefName, splitDefinitions } from './internal/json-schema.js';

export interface EventCatalogOptions {
  readonly title?: string;
  /** Consuming contexts by event type. Declared by hand: a producer does not know them. */
  readonly consumers?: Readonly<Record<string, readonly string[]>>;
}

export interface PayloadField {
  /** Dotted path; an array is written `lines[]` and its item fields `lines[].sku`. */
  readonly path: string;
  readonly type: string;
  readonly required: boolean;
  readonly description: string;
}

/**
 * A Markdown catalog of every declared event, grouped by producer context. Deterministic:
 * commit the file and let CI fail when the regenerated content differs.
 */
export function generateEventCatalog(
  registry: EventRegistry,
  options: EventCatalogOptions = {},
): string {
  const lines: string[] = [
    `# ${options.title ?? 'Event catalog'}`,
    '',
    'Generated from the integration event declarations. Do not edit by hand: regenerate.',
  ];

  const definitions = registry.all();
  const producers = [...new Set(definitions.map((definition) => definition.producer))].sort(
    compareText,
  );
  for (const producer of producers) {
    lines.push('', `## ${producer}`);
    const owned = definitions.filter((definition) => definition.producer === producer);
    for (const type of new Set(owned.map((definition) => definition.type))) {
      const versions = owned.filter((definition) => definition.type === type);
      lines.push('', `### ${type}`, '', ...versionsTable(versions));

      const consumers = [...(options.consumers?.[type] ?? [])].sort(compareText);
      if (consumers.length > 0) {
        lines.push('', `Consumers: ${consumers.map((name) => `\`${name}\``).join(', ')}`);
      }
      for (const definition of versions) {
        lines.push('', `#### Payload of version ${definition.version}`, '');
        lines.push(...payloadTable(payloadFields(definition.payload.toJsonSchema())));
      }
    }
  }
  return `${lines.join('\n')}\n`;
}

function versionsTable(versions: readonly AnyIntegrationEventDefinition[]): string[] {
  return table(
    ['Type', 'Version', 'Description', 'Deprecated'],
    versions.map((definition) => [
      `\`${definition.type}\``,
      String(definition.version),
      definition.description ?? '',
      definition.deprecated ? 'yes' : 'no',
    ]),
  );
}

function payloadTable(fields: readonly PayloadField[]): string[] {
  if (fields.length === 0) {
    return ['No documented field.'];
  }
  return table(
    ['Field', 'Type', 'Required', 'Description'],
    fields.map((field) => [
      `\`${field.path}\``,
      field.type,
      field.required ? 'yes' : 'no',
      field.description,
    ]),
  );
}

function table(header: readonly string[], rows: readonly (readonly string[])[]): string[] {
  const line = (cells: readonly string[]): string => `| ${cells.map(escapeCell).join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)];
}

function escapeCell(text: string): string {
  return text.replaceAll('|', '\\|').replaceAll(/\s*\n\s*/g, ' ');
}

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

function describe(property: unknown, target: Record<string, unknown>): string {
  const own = isRecord(property) ? property['description'] : undefined;
  const description = own ?? target['description'];
  return typeof description === 'string' ? description : '';
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
