import { isDeclarationsFile } from '../../declared/index.js';
import { declaredModules, isContextLevel, isRoleFolder, WITHOUT_MODULE } from '../../model-modules/index.js';
import type { Project } from '../model/project.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { pathInContext } from '../support/path-in-context.js';
import { reporter } from '../support/reporter.js';

/** How many files a finding names before it counts the rest. */
const NAMED = 5;

export const moduleComplete: Rule = {
  id: 'module/complete',
  description:
    'Once a context declares modules of its model, every file of its domain/ and application/ sits in one of them, the files that stay one per context aside (domain/errors/codes.ts, application/authorization/<context>.permissions.ts and the generated declarations). One finding per role folder still holding files at the level of the context. A warning, so that a context moves into its modules one commit at a time.',
  scope: 'project',
  run(project) {
    const report = reporter(project, this.id);

    return Object.keys(project.config.contexts).flatMap((context) => {
      const modules = declaredModules(project.config, context);

      if (modules.length === 0) {
        return [];
      }

      return [...outsideByFolder(project, context)].map(([folder, files]) => {
        const named = files.slice(0, NAMED).join(', ');
        const more = files.length > NAMED ? ` and ${files.length - NAMED} more` : '';

        return report(
          { file: `${project.config.contextsDir}/${context}/${folder}`, line: 1 },
          `${folder} of "${context}" holds ${files.length} file(s) outside every module of its model: ${named}${more}.`,
          `Move each into the module whose concepts it serves, its imports and the generated declarations rewritten: \`ddd-ts-kit move-to-module ${context} <${modules.join('|')}> ${folder}/<file or use case>\`.`,
        );
      });
    });
  },
};

/** The production files of a context left at its level, by the role folder they sit in, relative to the context. */
function outsideByFolder(project: Project, context: string): Map<string, string[]> {
  const byFolder = new Map<string, string[]>();

  for (const file of project.files.filter((candidate) => isLeftOutside(project, candidate, context))) {
    const [layer = '', role = '', ...rest] = (pathInContext(project, file) ?? file.path).split('/');
    const folder = `${layer}/${role}`;
    const known = byFolder.get(folder) ?? [];
    const moved = movedTogether(role, rest);

    byFolder.set(folder, known.includes(moved) ? known : [...known, moved]);
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
    isRoleFolder(location.layer, folder) &&
    !isContextLevel(context, relative) &&
    !isDeclarationsFile(context, relative, WITHOUT_MODULE)
  );
}
