import { specifierOf } from '../../../alias/index.js';
import type { RenderContext } from '../../../templating/index.js';
import { permissionsFile } from '../../permissions-file.js';
import type { Scope } from '../../scope.js';
import type { SentCommand } from './sent-command.js';

/** What the spec gives the system actor of the job, so that the guard lets its command through: the permission of the command, read where it is written. */
export function grantedInSpec(scope: Scope, command: SentCommand): RenderContext {
  const key = command.permission?.slice(scope.context.kebab.length + 1);
  const set = `${scope.context.camel}Permissions`;

  if (!command.isProtected) {
    return { granted: '', permissionsImport: '' };
  }

  if (key === undefined) {
    return { granted: "'*'", permissionsImport: '' };
  }

  return {
    granted: `${set}['${key}']`,
    permissionsImport: `import { ${set} } from '${specifierOf(scope.config, `${scope.config.contextsDir}/${scope.context.kebab}/${permissionsFile(scope.context)}`)}';`,
  };
}
