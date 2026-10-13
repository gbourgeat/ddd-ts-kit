import { isRecord } from '../config/values/is-record.js';
import { propertyKey } from './property-key.js';
import { schemaTypeName } from './schema-type-name.js';
import { docComment } from './doc-comment.js';

const INDENT = '  ';
const SCHEMA_REF = /^#\/components\/schemas\/(.+)$/;

const PRIMITIVES: Readonly<Record<string, string>> = {
  string: 'string',
  integer: 'number',
  number: 'number',
  boolean: 'boolean',
  null: 'null',
};

/**
 * The TypeScript type of a JSON Schema, as the client declares it: a reference names the type of
 * its component (behind `refPrefix`, `Schemas.` outside the file of the schemas), `enum` and
 * `const` are literal types, `oneOf` and `anyOf` unions, `allOf` an intersection, an object a type
 * literal whose optional properties are those it does not require. A keyword it does not know of
 * leaves the type open: `unknown`.
 */
export class SchemaTypes {
  constructor(private readonly refPrefix: string) {}

  typeOf(schema: unknown, depth: number): string {
    if (!isRecord(schema)) {
      return schema === false ? 'never' : 'unknown';
    }

    const base = this.baseOf(schema, depth);

    return schema['nullable'] === true && base !== 'unknown' ? `${base} | null` : base;
  }

  private baseOf(schema: Record<string, unknown>, depth: number): string {
    const ref = schema['$ref'];

    if (typeof ref === 'string') {
      const local = SCHEMA_REF.exec(ref)?.[1];

      return local === undefined ? 'unknown' : `${this.refPrefix}${schemaTypeName(local)}`;
    }

    if ('const' in schema) {
      return literal(schema['const']);
    }

    if (Array.isArray(schema['enum'])) {
      return union(schema['enum'].map(literal));
    }

    return this.combinedOf(schema, depth) ?? this.typedOf(schema, depth);
  }

  private combinedOf(schema: Record<string, unknown>, depth: number): string | undefined {
    for (const keyword of ['oneOf', 'anyOf'] as const) {
      const options = schema[keyword];

      if (Array.isArray(options)) {
        return union(options.map((option) => this.typeOf(option, depth)));
      }
    }

    const all = schema['allOf'];

    return Array.isArray(all) ? all.map((part) => grouped(this.typeOf(part, depth))).join(' & ') : undefined;
  }

  private typedOf(schema: Record<string, unknown>, depth: number): string {
    const type = schema['type'];

    if (Array.isArray(type)) {
      return union(type.map((one) => this.typedOf({ ...schema, type: one }, depth)));
    }

    if (type === 'array') {
      return `Array<${this.typeOf(schema['items'], depth)}>`;
    }

    if (type === 'object' || isRecord(schema['properties'])) {
      return this.objectOf(schema, depth);
    }

    return typeof type === 'string' ? (PRIMITIVES[type] ?? 'unknown') : 'unknown';
  }

  private objectOf(schema: Record<string, unknown>, depth: number): string {
    const properties = Object.entries(isRecord(schema['properties']) ? schema['properties'] : {});
    const extra = schema['additionalProperties'];

    if (properties.length === 0) {
      return extra === false ? 'Record<string, never>' : `Record<string, ${this.typeOf(extra ?? true, depth)}>`;
    }

    const required = Array.isArray(schema['required']) ? schema['required'] : [];
    const inner = INDENT.repeat(depth + 1);

    const members = properties.flatMap(([name, property]) => [
      ...docComment(isRecord(property) ? property['description'] : undefined, inner),
      `${inner}${propertyKey(name)}${required.includes(name) ? '' : '?'}: ${this.typeOf(property, depth + 1)};`,
    ]);

    const index = extra === undefined || extra === false ? [] : [`${inner}[key: string]: unknown;`];

    return `{\n${[...members, ...index].join('\n')}\n${INDENT.repeat(depth)}}`;
  }
}

function literal(value: unknown): string {
  return typeof value === 'string' ? quoted(value) : JSON.stringify(value);
}

function quoted(text: string): string {
  return `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', '\\n')}'`;
}

function union(types: readonly string[]): string {
  const distinct = [...new Set(types.map(grouped))];

  return distinct.length === 0 ? 'never' : distinct.join(' | ');
}

/** A union or an intersection put inside another one keeps its meaning in parentheses. */
function grouped(type: string): string {
  return hasTopLevelOperator(type) ? `(${type})` : type;
}

const OPENING = new Set(['{', '<', '(', '[']);
const CLOSING = new Set(['}', '>', ')', ']']);

/** A `|` or `&` outside every bracket and every quoted literal. */
function hasTopLevelOperator(type: string): boolean {
  let depth = 0;
  let quote = false;

  for (let index = 0; index < type.length; index += 1) {
    const character = type.charAt(index);

    if (character === "'" && type.charAt(index - 1) !== '\\') {
      quote = !quote;
    } else if (!quote) {
      depth += OPENING.has(character) ? 1 : CLOSING.has(character) ? -1 : 0;

      if (depth === 0 && (character === '|' || character === '&')) {
        return true;
      }
    }
  }

  return false;
}
