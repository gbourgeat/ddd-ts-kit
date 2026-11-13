import { escapeRegExp } from '../text/escape-reg-exp';
import type { DeclaredClass } from '../../read-models/declared-class';
import type { ImportedClass, ListedEntry, NamedStore, ReadModelList } from '../../read-models/read-model-list';
import type { Finding } from '../model/finding';
import type { Project } from '../model/project';
import { sourceAt } from '../project/source-at';

const ENTRY_FIX =
  "Name in the entry the context that holds the store and the class its file declares, `['<context>', <Store>],` with `import { <Store> } from '<the file of the store>';`, or remove the entry.";

const NAMED_FIX =
  'Remove the line: `NOT_LISTED` names the stores of the tree nothing checks, and the start tells each of them.';

/** The list, and the tree it is read against. */
interface Read {
  readonly project: Project;
  readonly list: ReadModelList;
  readonly classes: readonly DeclaredClass[];
}

/**
 * What the list says that the tree contradicts: an entry of `LISTED` whose class the file neither
 * imports nor declares, whose import leads to no file or to a file that does not name the class,
 * or whose class is declared in another context than the one the entry names; a line of
 * `NOT_LISTED` whose class no file of its context names. What a barrel re-exports, a package
 * exports or a file of the tests declares is not judged.
 */
export function listFindings(project: Project, list: ReadModelList, classes: readonly DeclaredClass[]): Finding[] {
  const entries = list.entries.flatMap((entry) => {
    const problem = problemOf({ project, list, classes }, entry);

    return problem === undefined ? [] : [{ line: entry.line, message: problem, fix: ENTRY_FIX }];
  });

  const named = list.notListed
    .filter((store) => !isNamedInItsContext(project, store))
    .map(({ context, store, line }) => ({
      line,
      message: `NOT_LISTED names \`${context}: ${store}\`, and no file of ${context} names a class ${store}: the start warns of a store that does not exist.`,
      fix: NAMED_FIX,
    }));

  return [...entries, ...named];
}

function problemOf({ project, list, classes }: Read, entry: ListedEntry): string | undefined {
  const here = classes.some(({ file, shape }) => file === list.file && shape.name === entry.local);

  if (!here && !list.imports.has(entry.local)) {
    return `LISTED names ${entry.local}, which the file neither imports by name nor declares.`;
  }

  const imported = importBehind(list, classes, entry.local);

  if (imported === undefined || imported.target.kind !== 'file') {
    return undefined;
  }

  const { name, target } = imported;
  const declared = classes.find(({ file, shape }) => file === target.path && shape.name === name);

  if (declared === undefined) {
    const missing = whatIsMissing(project, name, target.path);

    return missing === undefined ? undefined : `LISTED names ${entry.local}, imported from ${target.path}, ${missing}.`;
  }

  return declared.context === undefined || declared.context === entry.context
    ? undefined
    : `LISTED names ${name} under ${entry.context}, and ${target.path} declares it in ${declared.context}: its table is checked for the wrong context.`;
}

/** The import an entry leads to: its own, or the one a class the list declares extends, however far. */
function importBehind(
  list: ReadModelList,
  classes: readonly DeclaredClass[],
  local: string,
): ImportedClass | undefined {
  const seen: string[] = [];
  let name: string | undefined = local;

  while (name !== undefined && !seen.includes(name)) {
    const imported = list.imports.get(name);

    if (imported !== undefined) {
      return imported;
    }

    const declared: string = name;

    seen.push(declared);
    name = classes.find(({ file, shape }) => file === list.file && shape.name === declared)?.shape.superclass;
  }

  return undefined;
}

/** What the import of a class leads to when it is not that class: no file, or one that neither names it nor re-exports anything. */
function whatIsMissing(project: Project, name: string, file: string): string | undefined {
  const source = sourceAt(project, file);

  if (source === undefined) {
    return sourceAt(project, file.replace(/\.ts$/, '/index.ts')) === undefined ? 'which does not exist' : undefined;
  }

  const answers =
    source.isTest || names(source.scan.code, name) || source.scan.imports.some(({ kind }) => kind === 'export');

  return answers ? undefined : `which names no class ${name}`;
}

function isNamedInItsContext(project: Project, { context, store }: NamedStore): boolean {
  return project.files.some(
    ({ location, scan }) => location.area === 'context' && location.context === context && names(scan.code, store),
  );
}

function names(code: string, name: string): boolean {
  return new RegExp(`(?<![\\w$])${escapeRegExp(name)}(?![\\w$])`).test(code);
}
