import { scan } from '../../../check/scan/scan';
import { stringAt } from '../../../check/scan/string-at';

/** One name a module takes from another and exports: as that module calls it, as this one exports it, and whether as a type only. */
interface ReexportedName {
  readonly name: string;
  readonly local: string;
  readonly isType: boolean;
}

/** The names one `export { ... } from` takes, and the module it takes them from. */
export interface ReexportedNames {
  readonly source: string;
  readonly names: readonly ReexportedName[];
}

/** What one module exports, read from its own text alone. A name may be a value and a type at once: `values` and `types` both hold it. */
export interface ModuleExports {
  /** The names it exports as values: a constant, a function, a class, an enum it declares. */
  readonly values: readonly string[];
  /** The names it exports as types: an interface, a type, a name listed as a type. */
  readonly types: readonly string[];
  /** The names it takes from another module and exports, `export { a, b as c } from`, or imports by name then lists. */
  readonly named: readonly ReexportedNames[];
  /** The modules it re-exports whole, `export * from`. */
  readonly whole: readonly string[];
  /** Each `export` it holds that is not one of the forms above, read with certainty: nothing is then known of what the module exports. */
  readonly unread: readonly string[];
  /** The code of each `export` that is not read, comments and strings blanked. */
  readonly doubts: readonly string[];
}

/** A name, and nothing of a longer one after it: `café` is not `caf`. */
const NAME = String.raw`([\w$]+)(?=[\s(<{=:;,]|$)`;
const EXPORT = /(?<![\w$.])export(?![\w$])/g;
const LIST = /^export\s+(type\s+)?\{([^{}]*)\}\s*(from\s*)?/;
const WHOLE = /^export\s*\*\s*from\s*/;
const VALUE = new RegExp(String.raw`^export\s+(?:abstract\s+)?(?:async\s+)?(?:function\s*\*?|class|enum)\s+${NAME}`);
const TYPE = new RegExp(String.raw`^export\s+(?:declare\s+)?(?:interface|type)\s+${NAME}`);

const VARIABLE = new RegExp(String.raw`^export\s+(?:const|let|var)\s+${NAME}\s*(?=[:=])`);
const BINDING = /^(type\s+)?([\w$]+)(?:\s+as\s+([\w$]+))?$/;
const IMPORT = /(?<![\w$.])import\s+(type\s+)?\{([^{}]*)\}\s*from\s*/g;
/** A block whose `export` is one of the block, not of the module. */
const BLOCK = /(?<![\w$.])(?:namespace|module)(?![\w$])[^;={]*\{/;

type Read = Partial<ModuleExports>;

/**
 * Reads what a module exports, and answers for every `export` of its code, comments and strings
 * left out: a declaration of one name, a list of names, a module re-exported whole. Any other
 * form (two names declared in one statement, a pattern, a default, a module exported as a name, a
 * `declare` of a value, which the compiler exports and no module holds, a name the reader cannot
 * end with certainty) is named in `unread`: a reader that skipped it would
 * call a table absent that the compiler sees. So is a source the lexer may have misread: one that
 * holds a regular expression, which a division is sometimes read as, or a template that does not
 * close; and one that holds a `namespace` or `declare module` block. A name is read as a value, as
 * a type, or as both when the module declares both under it: the index exports the two
 * differently. It reads this module only, and follows nothing.
 */
export function readModule(source: string): ModuleExports {
  const scanned = scan(source);

  const read = [...scanned.code.matchAll(EXPORT)].map(({ index }): Read => {
    const rest = scanned.code.slice(index);
    const shown = rest.slice(0, 40).split('\n')[0]?.trim() ?? '';

    return (
      exportAt(source, { code: scanned.code, rest, index }) ?? {
        unread: [`line ${scanned.lineAt(index)}, \`${shown}\``],
        doubts: [rest.slice(0, 400).split(';')[0] ?? ''],
      }
    );
  });

  const misread = [
    ...(scanned.uncertain
      ? ['a regular expression, or a template that does not close, which hides what follows it']
      : []),
    ...(BLOCK.test(scanned.code)
      ? ['a `namespace` or `declare module` block, whose exports are not the ones of the file']
      : []),
  ];

  return merged([{ unread: misread }, ...read]);
}

function merged(read: readonly Read[]): ModuleExports {
  return {
    values: read.flatMap(({ values = [] }) => values),
    types: read.flatMap(({ types = [] }) => types),
    named: read.flatMap(({ named = [] }) => named),
    whole: read.flatMap(({ whole = [] }) => whole),
    unread: read.flatMap(({ unread = [] }) => unread),
    doubts: read.flatMap(({ doubts = [] }) => doubts),
  };
}

/** One `export` of the code: the code, what follows the token, comments and strings blanked, and where it stands in the source. */
interface ExportToken {
  readonly code: string;
  readonly rest: string;
  readonly index: number;
}

/** What one `export` brings, when it is a form read with certainty. */
function exportAt(source: string, token: ExportToken): Read | undefined {
  return listAt(source, token) ?? wholeAt(source, token) ?? declarationAt(token);
}

function listAt(source: string, { code, rest, index }: ExportToken): Read | undefined {
  const listed = LIST.exec(rest);
  const bindings = listed === null ? undefined : bindingsOf(listed[2] ?? '', listed[1] !== undefined);

  if (listed === null || bindings === undefined) {
    return undefined;
  }

  if (listed[3] !== undefined) {
    const from = stringAt(source, index + listed[0].length);

    return from === undefined ? undefined : { named: [{ source: from, names: bindings }] };
  }

  const read = bindings.map((binding) => listedHere(source, code, binding));

  return read.includes(undefined) ? undefined : merged(read.flatMap((one) => (one === undefined ? [] : [one])));
}

/**
 * A name listed without a module is what the module declares under it, a value, a type or both, or
 * what it imports by name: it is then the name of the module it comes from, as `export { } from`
 * would write it. A name the module neither declares nor imports by name is not read.
 */
function listedHere(source: string, code: string, { name, local, isType }: ReexportedName): Read | undefined {
  const declares = (keywords: string): boolean =>
    [
      ...code.matchAll(
        new RegExp(
          String.raw`(?<![\w$.])(?<![{,(]\s*)(?:${keywords})\s+${name.replace(/\$/g, String.raw`\$`)}(?=[\s(<{=:;,]|$)`,
          'g',
        ),
      ),
    ].some(({ index }) => isTopLevel(code, index));

  // Declared without a value, the compiler exports it and no module holds it: the reader does not answer for it.
  if (declares(String.raw`declare\s+(?:abstract\s+)?(?:const|let|var|function|class|enum)`)) {
    return undefined;
  }

  const isValue = declares(String.raw`const|let|var|function\s*\*?|class|enum`);
  const isTypeHere = declares('interface|type');

  if (isValue || isTypeHere) {
    return { values: isValue && !isType ? [local] : [], types: isTypeHere || isType ? [local] : [] };
  }

  return listedFromImport(source, code, { name, local, isType });
}

/** A name the module lists and does not declare: what it imports by name, or a type when written as one. */
function listedFromImport(source: string, code: string, { name, local, isType }: ReexportedName): Read | undefined {
  const imported = importedAs(source, code, name);

  if (imported === undefined) {
    // Written as a type, it is one, wherever it comes from.
    return isType ? { types: [local] } : undefined;
  }

  return {
    named: [{ source: imported.source, names: [{ name: imported.name, local, isType: isType || imported.isType }] }],
  };
}

/** Whether this place of the code is in no block: a declaration in a function is no declaration of the module. */
function isTopLevel(code: string, at: number): boolean {
  let depth = 0;

  for (const char of code.slice(0, at)) {
    depth += char === '{' ? 1 : char === '}' ? -1 : 0;
  }

  return depth === 0;
}

/** The module a name is imported from by name, and what that module calls it. */
function importedAs(
  source: string,
  code: string,
  local: string,
): { source: string; name: string; isType: boolean } | undefined {
  for (const found of code.matchAll(IMPORT)) {
    const from = stringAt(source, found.index + found[0].length);
    const binding = bindingsOf(found[2] ?? '', found[1] !== undefined)?.find((bound) => bound.local === local);

    if (from !== undefined && binding !== undefined) {
      return { source: from, name: binding.name, isType: binding.isType };
    }
  }

  return undefined;
}

function wholeAt(source: string, { rest, index }: ExportToken): Read | undefined {
  const whole = WHOLE.exec(rest);
  const specifier = whole === null ? undefined : stringAt(source, index + whole[0].length);

  return specifier === undefined ? undefined : { whole: [specifier] };
}

function declarationAt({ rest }: ExportToken): Read | undefined {
  const variable = VARIABLE.exec(rest);
  const type = TYPE.exec(rest);
  const value = variable === null ? VALUE.exec(rest) : isAlone(rest, variable[0].length) ? variable : null;

  if (value?.[1] !== undefined) {
    return { values: [value[1]] };
  }

  return type?.[1] === undefined ? undefined : { types: [type[1]] };
}

/** The names of a list, each as the module it comes from calls it and as this one exports it; undefined when a part is no name. */
function bindingsOf(clause: string, areTypes: boolean): ReexportedName[] | undefined {
  const parts = clause
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');

  const bindings = parts.map((part) => BINDING.exec(part));

  return bindings.some((binding) => binding === null)
    ? undefined
    : bindings.map((binding) => ({
        name: binding?.[2] ?? '',
        local: binding?.[3] ?? binding?.[2] ?? '',
        isType: areTypes || binding?.[1] !== undefined,
      }));
}

/**
 * Whether the declaration that starts here declares one name: its statement ends, at the level it
 * started, before any comma. A comma there is a second name, or a type the reader does not tell
 * from one: the statement is then not read.
 */
function isAlone(code: string, from: number): boolean {
  let depth = 0;

  for (const char of code.slice(from)) {
    depth += '([{'.includes(char) ? 1 : ')]}'.includes(char) ? -1 : 0;

    if (depth < 0 || (depth === 0 && char === ';')) {
      return true;
    }

    if (depth === 0 && char === ',') {
      return false;
    }
  }

  return true;
}
