import type { JsonSchema, Schema } from '@ddd-ts-kit/validation';
import { isRecord } from '../support/is-record.js';
import { compare } from './compare.js';

const COMPONENT = /^#\/components\/schemas\/(.+)$/;

/**
 * Local definitions (`$defs`) of the embedded JSON Schemas are moved to `components.schemas`,
 * because a `#/$defs/...` pointer means nothing once the schema sits inside a document. A shared
 * schema (`sharedSchema`, a class schema with `shared`, a zod schema with `.meta({ id })`) is a
 * reference to one of its definitions: it lands once among the components and every route that
 * uses it points at it.
 */
export class Definitions {
  private readonly schemas = new Map<string, JsonSchema>();

  private readonly sources = new Map<string, string>();

  embed(schema: Schema<unknown>): JsonSchema {
    const { $schema: _dialect, $defs, definitions, ...rest } = schema.toJsonSchema();
    const local = { ...(isRecord(definitions) ? definitions : {}), ...(isRecord($defs) ? $defs : {}) };
    const names = new Map<string, string>();

    for (const name of Object.keys(local).sort(compare)) {
      names.set(name, this.reserve(name, JSON.stringify(local[name])));
    }

    for (const [name, component] of names) {
      if (!this.schemas.has(component)) {
        this.schemas.set(component, asSchema(rewriteRefs(local[name], names)));
      }
    }

    return asSchema(rewriteRefs(rest, names));
  }

  all(): Record<string, JsonSchema> {
    return Object.fromEntries(this.schemas);
  }

  /** The schema itself when it is a reference to a component: the parameters of a request part are its properties. */
  resolve(schema: JsonSchema): JsonSchema {
    const reference = schema['$ref'];
    const component = typeof reference === 'string' ? COMPONENT.exec(reference)?.[1] : undefined;
    const target = component === undefined ? undefined : this.schemas.get(component);

    return target === undefined ? schema : this.resolve(target);
  }

  /** Two different definitions sharing a name get distinct component names. */
  private reserve(name: string, source: string): string {
    for (let attempt = 1; ; attempt += 1) {
      const candidate = attempt === 1 ? name : `${name}_${attempt}`;
      const known = candidate === 'Problem' ? '' : this.sources.get(candidate);

      if (known === undefined) {
        this.sources.set(candidate, source);

        return candidate;
      }

      if (known === source) {
        return candidate;
      }
    }
  }
}

function rewriteRefs(node: unknown, names: ReadonlyMap<string, string>): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => rewriteRefs(item, names));
  }

  if (!isRecord(node)) {
    return node;
  }

  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => {
      if (key === '$ref' && typeof value === 'string') {
        const local = /^#\/(?:\$defs|definitions)\/(.+)$/.exec(value);
        const component = local?.[1] === undefined ? undefined : names.get(local[1]);

        return [key, component === undefined ? value : `#/components/schemas/${component}`];
      }

      return [key, rewriteRefs(value, names)];
    }),
  );
}

function asSchema(node: unknown): JsonSchema {
  return isRecord(node) ? node : {};
}
