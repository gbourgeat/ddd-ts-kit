import type { DeclaredClasses } from '../../read-models/declared-classes';
import type { ListAnswers } from '../../read-models/list-answers';
import type { ImportedClass, ListedEntry, NamedStore, ReadModelList } from '../../read-models/read-model-list';
import type { Finding } from '../model/finding';
import type { Project } from '../model/project';
import { sourceAt } from '../project/source-at';
import { escapeRegExp } from '../text/escape-reg-exp';

const ENTRY_FIX =
  "Name in the entry the context that holds the store and the class its file declares, `['<context>', <Store>],` with `import { <Store> } from '<the file of the store>';`, or remove the entry.";

const NAMED_FIX =
  'Remove the line: `NOT_LISTED` names the stores of the tree nothing checks, and the start tells each of them.';

/** The list, and the tree it is read against. */
interface Read {
  readonly project: Project;
  readonly classes: DeclaredClasses;
  readonly answers: ListAnswers;
}

/**
 * What the list says that the tree contradicts: an entry of `LISTED` whose class the file neither
 * imports nor declares, whose import leads to no file or to a file that does not name the class,
 * or whose class is declared in another context than the one the entry names; a line of
 * `NOT_LISTED` whose class no file of its context names, or whose store an entry of `LISTED`
 * answers for. What a barrel re-exports, a package exports or a file of the tests declares is not
 * judged.
 */
export function listFindings(read: Read): Finding[] {
  const { list } = read.answers;

  const entries = list.entries.flatMap((entry) => {
    const problem = problemOf(read, entry);

    return problem === undefined ? [] : [{ line: entry.line, message: problem, fix: ENTRY_FIX }];
  });

  const named = list.notListed.flatMap((store) => {
    const problem = needlessLine(read, store);

    return problem === undefined ? [] : [{ line: store.line, message: problem, fix: NAMED_FIX }];
  });

  return [...entries, ...named];
}

function problemOf({ project, classes, answers: { list } }: Read, entry: ListedEntry): string | undefined {
  const here = classes.named(entry.local).some(({ file }) => file === list.file);

  if (!here && !list.imports.has(entry.local)) {
    return `LISTED names ${entry.local}, which the file neither imports nor declares.`;
  }

  const imported = importBehind(list, classes, entry.local);

  if (imported === undefined || imported.target.kind !== 'file') {
    return undefined;
  }

  const { name, target } = imported;

  const declared =
    name === 'default' ? classes.defaultOf(target.path) : classes.named(name).find(({ file }) => file === target.path);

  if (declared === undefined) {
    const missing = whatIsMissing(project, name, target.path);

    return missing === undefined ? undefined : `LISTED names ${entry.local}, imported from ${target.path}, ${missing}.`;
  }

  return declared.context === undefined || declared.context === entry.context
    ? undefined
    : `LISTED names ${declared.shape.name} under ${entry.context}, and ${target.path} declares it in ${declared.context}: its table is checked for the wrong context.`;
}

/** The import an entry leads to: its own, or the one a class the list declares extends, however far. */
function importBehind(list: ReadModelList, classes: DeclaredClasses, local: string): ImportedClass | undefined {
  const seen: string[] = [];
  let name: string | undefined = local;

  while (name !== undefined && !seen.includes(name)) {
    const imported = list.imports.get(name);

    if (imported !== undefined) {
      return imported;
    }

    seen.push(name);
    name = classes.named(name).find(({ file }) => file === list.file)?.shape.superclass;
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

  if (answers) {
    return undefined;
  }

  return name === 'default' ? 'which has no default export' : `which names no class ${name}`;
}

/** Why a line of `NOT_LISTED` should go: its class is gone, or `LISTED` answers for its store. */
function needlessLine({ project, answers }: Read, { context, store }: NamedStore): string | undefined {
  const isNamed = project.files.some(
    ({ location, scan }) => location.area === 'context' && location.context === context && names(scan.code, store),
  );

  if (!isNamed) {
    return `NOT_LISTED names \`${context}: ${store}\`, and no file of ${context} names a class ${store}: the start warns of a store that does not exist.`;
  }

  return answers.lists({ context, name: store })
    ? `NOT_LISTED names \`${context}: ${store}\`, which an entry of LISTED answers for: the start still warns that nothing checks its table.`
    : undefined;
}

function names(code: string, name: string): boolean {
  return new RegExp(`(?<![\\w$])${escapeRegExp(name)}(?![\\w$])`).test(code);
}
