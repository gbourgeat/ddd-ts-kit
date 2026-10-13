import type { JsonSchema } from '@ddd-ts-kit/validation';
import { isRecord } from '../support/is-record.js';
import type { SchemaType } from './schema-type.js';
import type { XmlHints } from './xml-hints.js';

const SCALAR_TYPES: readonly SchemaType[] = ['string', 'number', 'integer', 'boolean'];
const SCHEMA_TYPES: ReadonlySet<string> = new Set([...SCALAR_TYPES, 'object', 'array', 'null']);
const LOCAL_REFERENCE = /^#\/(?:\$defs|definitions|components\/schemas)\/(.+)$/;
const MAX_REFERENCES = 32;

/**
 * One node of a JSON Schema, read with the definitions of the document it belongs to: what the
 * representations and the forms ask of a response or a request schema, whatever library wrote it.
 */
export class SchemaNode {
  private constructor(
    readonly node: JsonSchema,
    private readonly root: JsonSchema,
  ) {}

  static of(root: JsonSchema): SchemaNode {
    return new SchemaNode(root, root).resolved();
  }

  /** The node a `$ref` points to, and the first alternative of `anyOf` or `oneOf` that is not `null`. */
  resolved(hops = 0): SchemaNode {
    const next = hops < MAX_REFERENCES ? this.step() : undefined;

    return next === undefined ? this : next.resolved(hops + 1);
  }

  type(): SchemaType | undefined {
    const { type } = this.node;
    const declared: unknown = Array.isArray(type) ? type.find((candidate: unknown) => candidate !== 'null') : type;

    if (typeof declared === 'string') {
      return isSchemaType(declared) ? declared : undefined;
    }

    if (isRecord(this.node['properties'])) {
      return 'object';
    }

    return this.node['items'] === undefined ? undefined : 'array';
  }

  isScalar(): boolean {
    const type = this.type();

    return type === undefined || SCALAR_TYPES.includes(type) || this.node['enum'] !== undefined;
  }

  properties(): readonly (readonly [string, SchemaNode])[] {
    const { properties } = this.node;

    if (!isRecord(properties)) {
      return [];
    }

    return Object.entries(properties).map(([name, node]) => [name, this.child(node)]);
  }

  required(): readonly string[] {
    const { required } = this.node;

    return Array.isArray(required) ? required.filter((name) => typeof name === 'string') : [];
  }

  items(): SchemaNode {
    return this.child(this.node['items']);
  }

  xml(): XmlHints {
    const { xml } = this.node;

    if (!isRecord(xml)) {
      return {};
    }

    return {
      ...(typeof xml['name'] === 'string' ? { name: xml['name'] } : {}),
      ...(xml['attribute'] === true ? { attribute: true } : {}),
      ...(xml['wrapped'] === true ? { wrapped: true } : {}),
      ...(typeof xml['namespace'] === 'string' ? { namespace: xml['namespace'] } : {}),
    };
  }

  private child(node: unknown): SchemaNode {
    return new SchemaNode(isRecord(node) ? node : {}, this.root).resolved();
  }

  private step(): SchemaNode | undefined {
    const reference = this.node['$ref'];

    if (typeof reference === 'string') {
      return new SchemaNode(this.definition(reference), this.root);
    }

    const alternatives = this.node['anyOf'] ?? this.node['oneOf'];

    if (!Array.isArray(alternatives)) {
      return undefined;
    }

    const chosen: unknown = alternatives.find(
      (alternative: unknown) => isRecord(alternative) && alternative['type'] !== 'null',
    );

    return isRecord(chosen) ? new SchemaNode(chosen, this.root) : undefined;
  }

  private definition(reference: string): JsonSchema {
    const name = LOCAL_REFERENCE.exec(reference)?.[1] ?? '';

    const found = [this.root['$defs'], this.root['definitions']]
      .map((definitions) => (isRecord(definitions) ? definitions[name] : undefined))
      .find(isRecord);

    return found ?? {};
  }
}

function isSchemaType(value: string): value is SchemaType {
  return SCHEMA_TYPES.has(value);
}
