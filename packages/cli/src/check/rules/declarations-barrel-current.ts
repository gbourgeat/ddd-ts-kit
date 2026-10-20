import { specifierOf } from '../../alias/index.js';
import {
  barrelFile,
  contextDeclarations,
  contextInjections,
  dependenciesFile,
  generatedDrift,
  isDeclarationsFile,
  renderDependenciesFile,
  renderInjections,
} from '../../declared/index.js';
import type { Flaw } from '../model/flaw.js';
import type { Project } from '../model/project.js';
import type { Rule } from '../model/rule.js';
import { sourceAt } from '../project/source-at.js';
import { isDeclaredStyle } from '../support/is-declared-style.js';
import { reporter } from '../support/reporter.js';

const REGENERATE =
  'Run `ddd-ts-kit docs`, or `ddd-ts-kit generate` again, which rewrite it: the file is derived from the role files of the context and from their constructor signatures, and never edited by hand.';

interface Judged {
  readonly file: string;
  readonly flaw: Flaw | undefined;
}

export const declarationsBarrelCurrent: Rule = {
  id: 'declarations/barrel-current',
  description:
    'In the declared style, the generated files of a context are what its tree says: with a barrel, the <folder>.declarations.ts of each role folder lists exactly its role files and registers the dependency list read from each constructor, and <context>.declarations.ts re-exports those files; under discovery <context>.dependencies.ts registers the lists alone.',
  scope: 'project',
  run(project) {
    if (!isDeclaredStyle(project)) {
      return [];
    }

    const report = reporter(project, this.id);

    return project.contextsOnDisk
      .filter((context) => project.config.contexts[context] !== undefined)
      .flatMap((context) => judge(project, context))
      .flatMap(({ file, flaw }) => (flaw === undefined ? [] : [report({ file, line: 1 }, flaw.message, flaw.fix)]));
  },
};

function judge(project: Project, context: string): Judged[] {
  const directory = `${project.config.contextsDir}/${context}`;
  const entries = entriesOf(project, context);
  const generated = entries.filter((entry) => isDeclarationsFile(context, entry));
  const specifierOfFile = (file: string): string => specifierOf(project.config, file);
  const sources = (file: string) => sourceAt(project, file);

  if (project.config.stack.assembly === 'discovery') {
    const injected = renderInjections(contextInjections(sources, directory, entries), specifierOfFile);
    const lists = { name: `dependency lists of "${context}"`, expected: renderDependenciesFile(injected) };

    return [
      ...generated.map((entry) => ({ file: `${directory}/${entry}`, flaw: leftBehind(context, entry) })),
      {
        file: `${directory}/${dependenciesFile(context)}`,
        flaw: stale(project, context, { ...lists, file: dependenciesFile(context), optional: true }),
      },
    ];
  }

  const { files } = contextDeclarations({ context, directory, entries, sources, specifierOf: specifierOfFile });

  return [
    ...[...files].map(([entry, expected]) => ({
      file: `${directory}/${entry}`,
      flaw: stale(project, context, { name: nameOf(context, entry), file: entry, expected, optional: false }),
    })),
    ...generated
      .filter((entry) => !files.has(entry))
      .map((entry) => ({ file: `${directory}/${entry}`, flaw: emptied(context, entry) })),
  ];
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

function emptied(context: string, entry: string): Flaw {
  return {
    message: `${entry} of "${context}" is generated for a folder that holds no declared role file any more: nothing keeps it up to date.`,
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
