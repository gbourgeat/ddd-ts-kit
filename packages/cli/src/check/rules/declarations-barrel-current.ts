import { barrelFile, renderBarrel } from '../../declared/index.js';
import type { Flaw } from '../model/flaw.js';
import type { Project } from '../model/project.js';
import type { Rule } from '../model/rule.js';
import { isDeclaredStyle } from '../support/is-declared-style.js';
import { reporter } from '../support/reporter.js';

const REGENERATE = 'Run `ddd-ts-kit generate` again, or `ddd-ts-kit docs`, which rewrite it: the barrel is derived from the role files of the context and never edited by hand.';
const EXPORT = /^export \* from '(.+)';$/;

export const declarationsBarrelCurrent: Rule = {
  id: 'declarations/barrel-current',
  description: 'In the declared style assembled by barrel, <context>.declarations.ts exists and lists exactly the role files of its context.',
  scope: 'project',
  run(project) {
    if (!isDeclaredStyle(project)) return [];

    const report = reporter(project, this.id);
    const { contextsDir, contexts } = project.config;

    return project.contextsOnDisk
      .filter((context) => contexts[context] !== undefined)
      .flatMap((context) => {
        const file = `${contextsDir}/${context}/${barrelFile(context)}`;
        const flaw = judge(project, context, file);

        return flaw === undefined ? [] : [report({ file, line: 1 }, flaw.message, flaw.fix)];
      });
  },
};

function judge(project: Project, context: string, file: string): Flaw | undefined {
  const written = project.files.find((candidate) => candidate.path === file)?.text.replaceAll('\r\n', '\n');

  if (project.config.stack.assembly === 'discovery') return written === undefined ? undefined : leftBehind(context);

  const expected = renderBarrel(entriesOf(project, context));

  if (written === expected) return undefined;
  if (written === undefined) return { message: `The barrel of "${context}" is missing: the composition root has nothing to assemble the context from.`, fix: REGENERATE };

  return { message: `The barrel of "${context}" is stale: ${difference(written, expected)}.`, fix: REGENERATE };
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

  return project.contextEntries.filter((entry) => entry.startsWith(prefix) && !entry.endsWith('/')).map((entry) => entry.slice(prefix.length));
}

/** The first thing that tells the written barrel from the expected one, in words. */
function difference(written: string, expected: string): string {
  const exportsOf = (barrel: string): string[] => barrel.split('\n').flatMap((line) => EXPORT.exec(line)?.[1] ?? []);
  const missing = exportsOf(expected).find((specifier) => !exportsOf(written).includes(specifier));

  if (missing !== undefined) return `it does not export ${missing}, so the class declared there is registered nowhere`;

  const extra = exportsOf(written).find((specifier) => !exportsOf(expected).includes(specifier));

  if (extra !== undefined) return `it exports ${extra}, which is not a role file of the context`;

  return 'it holds something else than one `export * from` per role file, sorted by path';
}
