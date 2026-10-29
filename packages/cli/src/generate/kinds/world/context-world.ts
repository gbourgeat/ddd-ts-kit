import type { Scope } from '../../scope';

/** The world of a context, read as a spec arranges through it: `test/worlds/<context>.world.ts`. */
export type ContextWorld = AbsentWorld | UnreadWorld | ReadWorld;

/** No file: `generate test-world` writes one. */
export interface AbsentWorld {
  readonly kind: 'absent';
}

/** A file the generator could not read: written or rewritten by hand, never replaced on its advice. */
export interface UnreadWorld {
  readonly kind: 'unread';
  /** What it looked for and did not find: `` `export function aBillingWorld` ``. */
  readonly looksFor: string;
}

export interface ReadWorld {
  readonly kind: 'read';
  /** Its file, from the project root. */
  readonly file: string;
  /** The function that builds it: `aBillingWorld`. */
  readonly builder: string;
  /** The names it returns its fakes under: `invoiceRepository`. */
  readonly fakes: ReadonlySet<string>;
  /** The options it declares itself: `modules`, `idPrefix`, `fakes`... */
  readonly options: ReadonlySet<string>;
  /** The interface of its options, `BillingWorldOptions`, and whether it extends a type the generator does not follow. */
  readonly optionsType: { readonly name: string; readonly extended: boolean };
}

/**
 * The world named after the context, read from its file as `generate test-world` writes it or as
 * a team edited it: the function `a<Context>World` (the name the generator writes), the members
 * of `<Context>WorldFakes` and of `<Context>WorldOptions`, whatever the types those members hold.
 */
export function contextWorld(scope: Scope): ContextWorld {
  const file = `${scope.dir}/test/worlds/${scope.context.kebab}.world.ts`;
  const source = scope.ws.read(file);
  const builder = `${scope.context.article}${scope.context.pascal}World`;
  const optionsName = `${scope.context.pascal}WorldOptions`;

  if (source === undefined) {
    return { kind: 'absent' };
  }

  if (!new RegExp(`\\bexport\\s+(?:async\\s+)?function\\s+${builder}\\s*\\(`).test(source)) {
    return { kind: 'unread', looksFor: `\`export function ${builder}\`` };
  }

  const options = interfaceOf(source, optionsName);

  if (options === undefined) {
    return { kind: 'unread', looksFor: `\`interface ${optionsName}\`` };
  }

  return {
    kind: 'read',
    file,
    builder,
    fakes: interfaceOf(source, `${scope.context.pascal}WorldFakes`)?.members ?? new Set(),
    options: options.members,
    optionsType: { name: optionsName, extended: options.extended },
  };
}

interface ReadInterface {
  readonly members: ReadonlySet<string>;
  readonly extended: boolean;
}

/** The members an interface declares itself, its nested object types aside, and whether it extends another. */
function interfaceOf(source: string, name: string): ReadInterface | undefined {
  const head = new RegExp(`\\binterface\\s+${name}\\b([^{]*)\\{`).exec(source);
  const body = head === null ? undefined : balanced(source, head.index + head[0].length);

  if (head === null || body === undefined) {
    return undefined;
  }

  const flat = flattened(body);
  const members = [...flat.matchAll(/^\s*(?:readonly\s+)?(\w+)\??\s*:/gm)].map((member) => member[1] ?? '');

  return { members: new Set(members), extended: /\bextends\b/.test(head[1] ?? '') };
}

/** What stands between the brace before `start` and the brace that closes it, or undefined when none does. */
function balanced(source: string, start: number): string | undefined {
  let depth = 1;

  for (let index = start; index < source.length; index += 1) {
    depth += source[index] === '{' ? 1 : source[index] === '}' ? -1 : 0;

    if (depth === 0) {
      return source.slice(start, index);
    }
  }

  return undefined;
}

/** The body with each nested object type emptied, so that only its own members start a line. */
function flattened(body: string): string {
  let flat = body;

  while (/\{[^{}]*\}/.test(flat)) {
    flat = flat.replace(/\{[^{}]*\}/g, '');
  }

  return flat;
}
