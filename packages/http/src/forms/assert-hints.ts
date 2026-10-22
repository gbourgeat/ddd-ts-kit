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

/** Every field a hint names is a field of the body, every lookup a `GET` route: a typo stops the build, not a user. */
export function assertHints({ operation, body, hints }: Hinted, lookups: ReadonlyMap<string, FieldLookup>): void {
  const known = new Set(pathsOf(body, '', 0));

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

/** The fields of the body and of its nested objects, dotted; a schema that holds itself is followed a few levels only. */
function pathsOf(node: SchemaNode, prefix: string, depth: number): string[] {
  if (depth > MAX_DEPTH) {
    return [];
  }

  return node
    .properties()
    .flatMap(([name, child]) => [`${prefix}${name}`, ...pathsOf(child, `${prefix}${name}.`, depth + 1)]);
}

function fieldsOfGroup(group: FormGroupHint): string[] {
  return [...group.fields, ...(group.groups ?? []).flatMap(fieldsOfGroup)];
}
