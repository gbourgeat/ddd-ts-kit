import { escapeRegExp } from '../check/text/escape-reg-exp';
import { withImport } from '../generate/with-import';

const STATEMENT = /^import\s[^;]*;[ \t]*$/gm;
const CLAUSE = /^import\s+(type\s+)?([\s\S]*?)\s+from\s+(['"][^'"]+['"])/;

/**
 * The text with the imports of the file before that lines it kept need: a generator adds an import
 * after the last one of the file, outside any region, and a grant kept without it would name
 * nothing. Only the names the lines use and the text does not import yet are added, each after the
 * import it followed when the text holds that one.
 */
export function withNamedImports(text: string, existing: string, kept: readonly string[]): string {
  const code = kept.join('\n');
  const statements = statementsOf(existing);

  return statements.reduce((current, statement, index) => {
    const line = missingPart(statement, new Set(statementsOf(current).flatMap(boundNames)), code);

    if (line === undefined) {
      return current;
    }

    const twin = twinOf(current, statement, line);

    return twin === undefined ? placed(current, line, statements[index - 1]) : current.replace(twin, () => statement);
  }, text);
}

function placed(text: string, line: string, previous: string | undefined): string {
  const after = previous === undefined ? undefined : `${previous}\n`;

  return after !== undefined && text.includes(after)
    ? text.replace(after, () => `${after}${line}\n`)
    : withImport(text, line);
}

/** The statement of the text this one can stand for, a name a generator added to it being all that differs: it is written back whole, as it was. */
function twinOf(text: string, statement: string, line: string): string | undefined {
  const names = boundNames(statement);
  const added = boundNames(line);
  const held = (candidate: string): boolean => boundNames(candidate).every((name) => names.includes(name));

  return statementsOf(text).find(
    (candidate) =>
      sourceOf(candidate) === sourceOf(statement) &&
      held(candidate) &&
      names.every((name) => added.includes(name) || boundNames(candidate).includes(name)),
  );
}

function sourceOf(statement: string): string | undefined {
  return CLAUSE.exec(statement)?.[3];
}

function statementsOf(text: string): string[] {
  return [...text.matchAll(STATEMENT)].map(([statement]) => statement.trim());
}

/** The statement itself when the code needs all it binds, narrowed to the named imports it needs otherwise. */
function missingPart(statement: string, bound: ReadonlySet<string>, code: string): string | undefined {
  const names = boundNames(statement);
  const wanted = names.filter((name) => !bound.has(name) && new RegExp(`\\b${escapeRegExp(name)}\\b`).test(code));

  if (wanted.length === 0) {
    return undefined;
  }

  return wanted.length === names.length ? statement : narrowed(statement, wanted);
}

function narrowed(statement: string, wanted: readonly string[]): string | undefined {
  const [, type = '', clause = '', source = ''] = CLAUSE.exec(statement) ?? [];
  const specifiers = /^\{([^}]*)\}$/.exec(clause.trim())?.[1]?.split(',') ?? [];
  const named = specifiers.map((specifier) => specifier.trim()).filter((one) => wanted.includes(boundName(one)));

  return named.length === 0 ? undefined : `import ${type}{ ${named.join(', ')} } from ${source};`;
}

function boundNames(statement: string): string[] {
  const clause = CLAUSE.exec(statement)?.[2] ?? '';
  const named = /\{([^}]*)\}/.exec(clause)?.[1]?.split(',') ?? [];
  const others = clause.replace(/\{[^}]*\}/, '').split(',');

  return [...others, ...named].map(boundName).filter((name) => name !== '');
}

/** What a specifier binds: `b` of `a as b`, of `type b`, of `* as b`. */
function boundName(specifier: string): string {
  return specifier.trim().split(/\s+/).at(-1) ?? '';
}
