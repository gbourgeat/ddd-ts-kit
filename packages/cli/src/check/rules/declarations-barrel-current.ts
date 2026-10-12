import { specifierOf } from '../../alias/index.js';
import {
  barrelFile,
  contextInjections,
  dependenciesFile,
  generatedDrift,
  renderBarrel,
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
    'In the declared style, the generated file of a context is what its tree says: <context>.declarations.ts lists exactly its role files and registers the dependency list read from each constructor; under discovery <context>.dependencies.ts registers the lists alone.',
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
  const barrel = `${directory}/${barrelFile(context)}`;
  const entries = entriesOf(project, context);
  const injections = contextInjections((file) => sourceAt(project, file), directory, entries);
  const injected = renderInjections(injections, (file) => specifierOf(project.config, file));

  if (project.config.stack.assembly === 'discovery') {
    const lists = { name: 'dependency lists', expected: renderDependenciesFile(injected), optional: true };

    return [
      { file: barrel, flaw: writtenIn(project, barrel) === undefined ? undefined : leftBehind(context) },
      { file: `${directory}/${dependenciesFile(context)}`, flaw: stale(project, context, lists) },
    ];
  }

  const expected = renderBarrel(entries, (entry) => specifierOf(project.config, `${directory}/${entry}`), injected);

  return [{ file: barrel, flaw: stale(project, context, { name: 'barrel', expected, optional: false }) }];
}

interface Generated {
  /** What the file is, in the message. */
  readonly name: string;
  readonly expected: string;
  /** True when the file may be absent as long as it would register nothing. */
  readonly optional: boolean;
}

function stale(project: Project, context: string, { name, expected, optional }: Generated): Flaw | undefined {
  const file = name === 'barrel' ? barrelFile(context) : dependenciesFile(context);
  const written = writtenIn(project, `${project.config.contextsDir}/${context}/${file}`);

  if (written === expected || (written === undefined && optional && expected === 'export {};\n')) {
    return undefined;
  }

  if (written === undefined) {
    return {
      message: `The ${name} of "${context}" ${name === 'barrel' ? 'is' : 'are'} missing: the composition root has nothing to ${name === 'barrel' ? 'assemble the context from' : 'inject its constructors from'}.`,
      fix: REGENERATE,
    };
  }

  return {
    message: `The ${name} of "${context}" ${name === 'barrel' ? 'is' : 'are'} stale: ${generatedDrift(written, expected)}.`,
    fix: REGENERATE,
  };
}

function writtenIn(project: Project, file: string): string | undefined {
  return project.files.find((candidate) => candidate.path === file)?.text.replaceAll('\r\n', '\n');
}

function leftBehind(context: string): Flaw {
  return {
    message: `The barrel of "${context}" still exists although "stack.assembly" is "discovery": nothing keeps it up to date.`,
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
