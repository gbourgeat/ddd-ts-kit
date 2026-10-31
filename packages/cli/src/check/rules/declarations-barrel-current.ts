import { specifierOf } from '../../alias';
import path from 'node:path';
import {
  barrelFile,
  contextDeclarations,
  contextInjections,
  declaredRoleOf,
  dependenciesFile,
  generatedDrift,
  type DeclaredContext,
  earlierLayoutNotice,
  earlierLayoutOf,
  isDeclarationsFile,
  renderDependenciesFile,
  renderInjections,
} from '../../declared';
import { declaredModules } from '../../model-modules';
import type { Flaw } from '../model/flaw';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import { sourceAt } from '../project/source-at';
import { isDeclaredStyle } from '../support/is-declared-style';
import { reporter } from '../support/reporter';
import { ownEntry } from '../../config/values/own-entry';

const REGENERATE =
  'Run `ddd-ts-kit docs`, or `ddd-ts-kit generate` again, which rewrite it: the file is derived from the role files of the context and from their constructor signatures, and never edited by hand.';

interface Judged {
  readonly file: string;
  readonly flaw: Flaw | undefined;
}

export const declarationsBarrelCurrent: Rule = {
  id: 'declarations/barrel-current',
  description:
    'In the declared style, the generated files of a context are what its tree says: with a barrel, the <layer>.declarations.ts of each layer lists exactly its role files and registers the dependency list read from each constructor, and <context>.declarations.ts re-exports those files; under discovery <context>.dependencies.ts registers the lists alone.',
  scope: 'project',
  run(project) {
    if (!isDeclaredStyle(project)) {
      return [];
    }

    const report = reporter(project, this.id);

    return project.contextsOnDisk
      .filter((context) => ownEntry(project.config.contexts, context) !== undefined)
      .flatMap((context) => judge(project, context))
      .flatMap(({ file, flaw }) => (flaw === undefined ? [] : [report({ file, line: 1 }, flaw.message, flaw.fix)]));
  },
};

function judge(project: Project, context: string): Judged[] {
  const directory = `${project.config.contextsDir}/${context}`;
  const entries = entriesOf(project, context);
  const modules = declaredModules(project.config, context);
  const specifierOfFile = (file: string): string => specifierOf(project.config, file);
  const sources = (file: string) => sourceAt(project, file);

  if (project.config.stack.assembly === 'discovery') {
    const injected = renderInjections(contextInjections(sources, { directory, entries, modules }), specifierOfFile);
    const lists = { name: `dependency lists of "${context}"`, expected: renderDependenciesFile(injected, modules) };
    const generated = entries.filter((entry) => isDeclarationsFile(context, entry, modules));

    return [
      ...generated.map((entry) => ({ file: `${directory}/${entry}`, flaw: leftBehind(context, entry) })),
      {
        file: `${directory}/${dependenciesFile(context)}`,
        flaw: stale(project, context, { ...lists, file: dependenciesFile(context), optional: true }),
      },
    ];
  }

  return judgeDeclarations(project, { context, directory, entries, sources, modules, specifierOf: specifierOfFile });
}

/** With a barrel: the declarations of each layer and their summary, or the layout an earlier version wrote, to move. */
function judgeDeclarations(project: Project, declared: DeclaredContext): Judged[] {
  const { context, directory, entries, modules } = declared;
  const { files } = contextDeclarations(declared);

  const judged = [
    ...[...files].map(([entry, expected]) => ({
      file: `${directory}/${entry}`,
      flaw: stale(project, context, { name: nameOf(context, entry), file: entry, expected, optional: false }),
    })),
    ...entries
      .filter((entry) => isDeclarationsFile(context, entry, modules) && !files.has(entry))
      .map((entry) => ({ file: `${directory}/${entry}`, flaw: underived(context, entry) })),
    ...twins(declared),
  ];

  const layout = judged.some(({ flaw }) => flaw !== undefined)
    ? earlierLayoutOf(declared, (entry) => writtenIn(project, `${directory}/${entry}`))
    : undefined;

  // Two role files of one name stay an error in any layout: the summary would not compile.
  return layout === undefined
    ? judged
    : [{ file: `${directory}/${barrelFile(context)}`, flaw: earlierLayoutNotice(context, layout) }, ...twins(declared)];
}

/**
 * Two role files of one name in two folders of a context, as two modules of the model may hold:
 * the summary re-exports both folders with `export *`, and the compiler refuses the name they
 * both export. One name is one concept in a context.
 */
function twins({ context, directory, entries, modules }: DeclaredContext): Judged[] {
  const byName = new Map<string, string[]>();

  for (const entry of entries.filter((candidate) => declaredRoleOf(candidate, modules) !== undefined).sort()) {
    const name = path.posix.basename(entry);

    byName.set(name, [...(byName.get(name) ?? []), entry]);
  }

  return [...byName.values()]
    .filter((files) => files.length > 1)
    .map(([first = '', second = '']) => ({
      file: `${directory}/${second}`,
      flaw: {
        message: `${second} of "${context}" has the name of ${first}: the declarations of the context would export the same name twice.`,
        fix: 'One name is one concept in a context: rename one after the concept it holds, or merge the two into the module that owns the concept.',
      },
    }));
}

interface Generated {
  /** What the file holds, in the message, as the subject of a plural verb. */
  readonly name: string;
  /** The file, relative to the context. */
  readonly file: string;
  readonly expected: string;
  /** True when the file may be absent as long as it would register nothing. */
  readonly optional: boolean;
}

function nameOf(context: string, entry: string): string {
  return entry === barrelFile(context)
    ? `declarations of "${context}"`
    : `declarations of "${context}" in ${entry.slice(0, entry.lastIndexOf('/'))}/`;
}

function stale(project: Project, context: string, { name, file, expected, optional }: Generated): Flaw | undefined {
  const written = writtenIn(project, `${project.config.contextsDir}/${context}/${file}`);

  if (written === expected || (written === undefined && optional && expected === 'export {};\n')) {
    return undefined;
  }

  if (written === undefined) {
    const lacks = file === dependenciesFile(context) ? 'inject its constructors from' : 'assemble these classes from';

    return { message: `The ${name} are missing: the composition root has nothing to ${lacks}.`, fix: REGENERATE };
  }

  return { message: `The ${name} are stale: ${generatedDrift(written, expected)}.`, fix: REGENERATE };
}

function writtenIn(project: Project, file: string): string | undefined {
  return project.files.find((candidate) => candidate.path === file)?.text.replaceAll('\r\n', '\n');
}

function underived(context: string, entry: string): Flaw {
  return {
    message: `${entry} of "${context}" is generated for a folder that holds no declarations any more (a layer without declared role file, or a role folder, which an earlier version declared on its own): nothing keeps it up to date.`,
    fix: 'Run `ddd-ts-kit docs`, or `ddd-ts-kit generate` again, which delete it, and commit the deletion.',
  };
}

function leftBehind(context: string, entry: string): Flaw {
  return {
    message: `${entry} of "${context}" still exists although "stack.assembly" is "discovery": nothing keeps it up to date.`,
    fix: `Delete it and assemble ${context} with discoverContext('${context}', <directory>), or set "stack.assembly" to "barrel" and run \`ddd-ts-kit generate\` again.`,
  };
}

/** The files of a context, relative to it. */
function entriesOf(project: Project, context: string): string[] {
  const prefix = `${project.config.contextsDir}/${context}/`;

  return project.contextEntries
    .filter((entry) => entry.startsWith(prefix) && !entry.endsWith('/'))
    .map((entry) => entry.slice(prefix.length));
}
