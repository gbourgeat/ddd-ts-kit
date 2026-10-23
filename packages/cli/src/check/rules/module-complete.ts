import { isDeclarationsFile } from '../../declared';
import path from 'node:path';
import {
  declaredModules,
  isContextLevel,
  isRoleFolder,
  MODULE_LAYERS,
  MODULE_TEST_FOLDERS,
  moduleSplit,
  WITHOUT_MODULE,
} from '../../model-modules';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { pathInContext } from '../support/path-in-context';
import { reporter } from '../support/reporter';

/** How many files a finding names before it counts the rest. */
const NAMED = 5;

export const moduleComplete: Rule = {
  id: 'module/complete',
  description:
    'Once a context declares modules of its model, every file of its layers sits in one of them (<module>/domain/, <module>/application/, <module>/infrastructure/, <module>/presentation/), and every spec of one of their files in the module folder of its test folder (test/unit/<module>/), the files the context keeps at its own level aside: the code list and the permission set at its root, the schema, tables and migrations of its database, its route groups, guards and shared shapes, the fakes, builders and worlds of its specs, and the generated declarations. A module still where 0.86 and 0.87 put it (domain/<module>/, application/<module>/) is reported too. One finding per folder. A warning, so that a context moves into its modules one commit at a time.',
  scope: 'project',
  run(project) {
    const report = reporter(project, this.id);

    return Object.keys(project.config.contexts).flatMap((context) => {
      const modules = declaredModules(project.config, context);

      if (modules.length === 0) {
        return [];
      }

      const at = (folder: string) => ({ file: `${project.config.contextsDir}/${context}/${folder}`, line: 1 });

      const earlier = [...earlierByFolder(project, context, modules)].map(([folder, module]) =>
        report(
          at(folder),
          `${folder}/ of "${context}" is the module ${module} where 0.86 and 0.87 put it: a module now holds its layers, ${module}/domain/, ${module}/application/...`,
          `Run \`npx ddd-ts-kit context-layout ${context}\`, which moves each module to its folder with its adapters, routes and specs, and every import of them.`,
        ),
      );

      const outside = [...outsideByFolder(project, context)].map(([folder, files]) =>
        report(
          at(folder),
          `${folder} of "${context}" holds ${files.length} file(s) outside every module of its model: ${listed(files)}.`,
          `Move each into the module whose concepts it serves, its imports and the generated declarations rewritten: \`ddd-ts-kit move-to-module ${context} <${modules.join('|')}> ${folder}/<file or use case>\`.`,
        ),
      );

      return [...earlier, ...outside];
    });
  },
};

function listed(files: readonly string[]): string {
  const more = files.length > NAMED ? ` and ${files.length - NAMED} more` : '';

  return `${files.slice(0, NAMED).join(', ')}${more}`;
}

/** The folders of the modules of a context laid out as 0.86 and 0.87 laid them, `domain/<module>`, with the module each is. */
function earlierByFolder(project: Project, context: string, modules: readonly string[]): Map<string, string> {
  const prefix = `${project.config.contextsDir}/${context}/`;
  const byFolder = new Map<string, string>();

  for (const file of project.files.filter((candidate) => candidate.path.startsWith(prefix))) {
    const relative = file.path.slice(prefix.length);
    const { module, earlier } = moduleSplit(relative, modules);

    if (module !== undefined && earlier === true) {
      byFolder.set(relative.split('/').slice(0, 2).join('/'), module);
    }
  }

  return byFolder;
}

/** The files of a context left at its level, by the folder they sit in, relative to the context. */
function outsideByFolder(project: Project, context: string): Map<string, string[]> {
  const byFolder = new Map<string, string[]>();

  const add = (folder: string, name: string): void => {
    const known = byFolder.get(folder) ?? [];

    byFolder.set(folder, known.includes(name) ? known : [...known, name]);
  };

  for (const file of project.files.filter((candidate) => isLeftOutside(project, candidate, context))) {
    const [layer = '', role = '', ...rest] = (pathInContext(project, file) ?? file.path).split('/');

    add(`${layer}/${role}`, movedTogether(role, rest));
  }

  for (const spec of specsOfModules(project, context)) {
    const [, kind = ''] = (pathInContext(project, spec) ?? spec.path).split('/');

    add(`test/${kind}`, path.posix.basename(spec.path));
  }

  return byFolder;
}

/** What moves as one piece: the folder of a use case, with its command, handler and result, or a file. */
function movedTogether(role: string, rest: readonly string[]): string {
  return (role === 'commands' || role === 'queries') && rest.length > 1 ? (rest[0] ?? '') : rest.join('/');
}

function isLeftOutside(project: Project, file: SourceFile, context: string): boolean {
  const { location } = file;

  if (file.isTest || location.area !== 'context' || location.context !== context || location.module !== undefined) {
    return false;
  }

  const relative = pathInContext(project, file) ?? '';
  const [folder = ''] = location.inside;

  // A folder that is no role folder is an undeclared module or a stray: tree/closed reports it.
  return (
    MODULE_LAYERS.includes(location.layer) &&
    isRoleFolder(location.layer, folder) &&
    !isContextLevel(context, relative) &&
    !isDeclarationsFile(context, relative, WITHOUT_MODULE)
  );
}

/**
 * The specs of the context level of `test/unit/` and `test/integration/` whose subject sits in a
 * module: the file their name starts with (`appointment.repository.contract.spec.ts` is of
 * `appointment.repository.ts`).
 */
function specsOfModules(project: Project, context: string): SourceFile[] {
  const names = namesInModules(project, context);

  return project.files.filter((file) => {
    const stem = contextLevelSpecStem(file, context);

    return stem !== undefined && names.some((name) => stem === name || stem.startsWith(`${name}.`));
  });
}

/** The names, without their extension, of the production files of the modules of a context. */
function namesInModules(project: Project, context: string): string[] {
  return project.files
    .filter(({ location, isTest }) => !isTest && location.area === 'context' && location.context === context)
    .filter(({ location }) => location.area === 'context' && location.module !== undefined)
    .map((file) => path.posix.basename(file.path).replace(/\.ts$/, ''));
}

/** The name without `.spec.ts` of a spec of `test/unit/` or `test/integration/` of a context, in no module. */
function contextLevelSpecStem(file: SourceFile, context: string): string | undefined {
  const { location } = file;

  if (location.area !== 'context' || location.context !== context || location.module !== undefined) {
    return undefined;
  }

  // A spec may sit deeper, mirroring the production tree (test/unit/domain/slot.vo.spec.ts).
  const [kind = '', ...below] = location.inside;
  const name = below.at(-1) ?? '';
  const inItsFolder = location.layer === 'test' && MODULE_TEST_FOLDERS.includes(kind) && below.length > 0;

  return inItsFolder && name.endsWith('.spec.ts') ? name.slice(0, -'.spec.ts'.length) : undefined;
}
