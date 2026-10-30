import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { SchemaNode } from '../schema/schema-node';
import type { FieldLookup } from './field-lookup';
import type { FormGroupHint } from './form-group-hint';
import type { FormHints } from './form-hints';

const MAX_DEPTH = 8;

interface Hinted {
  readonly operation: string;
  readonly body: SchemaNode;
  readonly hints: FormHints;
}

/**
 * Every field a hint names is a field of the body, every lookup a `GET` route: a typo stops the
 * build, not a user. A field of a form is named by its path, whose segments a dot separates: a
 * property with a dot in its name would read as a nested field and lose its schema.
 */
export function assertHints({ operation, body, hints }: Hinted, lookups: ReadonlyMap<string, FieldLookup>): void {
  const paths = pathsOf(body, [], 0);
  const dotted = paths.flat().find((name) => name.includes('.'));

  if (dotted !== undefined) {
    throw new DeclarationError(
      `The form of "${operation}" holds the property "${dotted}": a field of a form is named by its path, whose segments a dot separates. Rename the property.`,
    );
  }

  const known = new Set(paths.map((path) => path.join('.')));

  const named = [
    ...Object.keys(hints.fields ?? {}),
    ...(hints.groups ?? []).flatMap(fieldsOfGroup),
    ...Object.values(hints.fields ?? {}).flatMap((hint) => [hint?.visibleWhen?.field, hint?.requiredWhen?.field]),
  ].filter((name): name is string => name !== undefined);

  const unknown = named.find((name) => !known.has(name));

  if (unknown !== undefined) {
    throw new DeclarationError(`The form of "${operation}" names "${unknown}", which its request body does not hold.`);
  }

  const lookup = Object.values(hints.fields ?? {}).find(
    (hint) => hint?.lookup !== undefined && !lookups.has(hint.lookup),
  );

  if (lookup?.lookup !== undefined) {
    throw new DeclarationError(
      `The form of "${operation}" looks its options up from "${lookup.lookup}", which is no GET route.`,
    );
  }
}

/** The fields of the body and of its nested objects, each as its segments; a schema that holds itself is followed a few levels only. */
function pathsOf(node: SchemaNode, prefix: readonly string[], depth: number): (readonly string[])[] {
  if (depth > MAX_DEPTH) {
    return [];
  }

  return node.properties().flatMap(([name, child]) => {
    const path = [...prefix, name];

    return [path, ...pathsOf(child, path, depth + 1)];
  });
}

function fieldsOfGroup(group: FormGroupHint): string[] {
  return [...group.fields, ...(group.groups ?? []).flatMap(fieldsOfGroup)];
}
