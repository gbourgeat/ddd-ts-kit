import type { Scope } from '../../scope';

/** The world of a context as a spec arranges through it: `test/worlds/<context>.world.ts`. */
export interface ContextWorld {
  /** Its file, from the project root. */
  readonly file: string;
  /** The function that builds it: `aBillingWorld`. */
  readonly builder: string;
  /** The names it returns its fakes under: `invoiceRepository`. */
  readonly fakes: ReadonlySet<string>;
  /** The options it takes: `modules`, `idPrefix`, `fakes`... */
  readonly options: ReadonlySet<string>;
}

const BUILDER = /\bexport\s+(?:async\s+)?function\s+(\w+)\s*\(/;

/**
 * The world named after the context, read from its file as `generate test-world` writes it or as
 * a team edited it: its exported function, the members of its `...WorldFakes` and of its
 * `...WorldOptions`. Undefined when the file does not exist or exports no function.
 */
export function contextWorld(scope: Scope): ContextWorld | undefined {
  const file = `${scope.dir}/test/worlds/${scope.context.kebab}.world.ts`;
  const source = scope.ws.read(file);
  const builder = source === undefined ? undefined : BUILDER.exec(source)?.[1];

  if (source === undefined || builder === undefined) {
    return undefined;
  }

  return {
    file,
    builder,
    fakes: membersOf(source, 'WorldFakes'),
    options: membersOf(source, 'WorldOptions'),
  };
}

/** The members of the interface whose name ends with `suffix`: `readonly name?: Type;`, one per line. */
function membersOf(source: string, suffix: string): ReadonlySet<string> {
  const body = new RegExp(`\\binterface\\s+\\w*${suffix}\\s*\\{([^}]*)\\}`).exec(source)?.[1] ?? '';

  return new Set([...body.matchAll(/^\s*(?:readonly\s+)?(\w+)\??\s*:/gm)].map((member) => member[1] ?? ''));
}
