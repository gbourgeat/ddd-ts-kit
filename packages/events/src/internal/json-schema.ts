import type { JsonSchema } from '@ddd-ts-kit/validation';

// Code-unit order, not locale order: generated files must not depend on the machine's locale.
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asSchema(node: unknown): JsonSchema {
  return isRecord(node) ? node : {};
}

export function sortKeys<T>(record: Readonly<Record<string, T>>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => compareText(a, b)));
}

const LOCAL_REF = /^#\/(?:\$defs|definitions)\/(.+)$/;

/** The name a local pointer (`#/$defs/Name`) designates, if it is one. */
export function localRefName(ref: unknown): string | undefined {
  return typeof ref === 'string' ? LOCAL_REF.exec(ref)?.[1] : undefined;
}

export interface SplitSchema {
  readonly schema: JsonSchema;
  readonly definitions: Readonly<Record<string, unknown>>;
}

/** Separates a schema from its dialect marker and its local definitions. */
export function splitDefinitions(source: JsonSchema): SplitSchema {
  const { $schema: _dialect, $defs, definitions, ...schema } = source;
  return {
    schema,
    definitions: {
      ...(isRecord(definitions) ? definitions : {}),
      ...(isRecord($defs) ? $defs : {}),
    },
  };
}

export function rewriteLocalRefs(node: unknown, rename: (name: string) => string | undefined): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => rewriteLocalRefs(item, rename));
  }
  if (!isRecord(node)) {
    return node;
  }
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => {
      if (key === '$ref') {
        const name = localRefName(value);
        const target = name === undefined ? undefined : rename(name);
        return [key, target ?? value];
      }
      return [key, rewriteLocalRefs(value, rename)];
    }),
  );
}
