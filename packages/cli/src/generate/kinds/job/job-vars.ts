import { specifierOf } from '../../../alias/index.js';
import type { Name } from '../../../naming/index.js';
import type { RenderContext } from '../../../templating/index.js';
import { permissionsFile } from '../../permissions-file.js';
import type { Scope } from '../../scope.js';
import { grantSystemActor } from './grant-system-actor.js';
import type { SentCommand } from './sent-command.js';

const PERIOD =
  'which period the work is for is said by `execution.scheduledAt`, never by the clock: an occurrence may run late, or twice';

export interface JobParts {
  readonly name: Name;
  /** The schedule as the source writes it. */
  readonly schedule: string;
  readonly command: SentCommand;
}

/** What the templates of a job read; the grant of its system actor is written on the way, where the model allows. */
export function jobVars(scope: Scope, { name, schedule, command }: JobParts): RenderContext {
  const jobName = `${scope.context.kebab}.${name.kebab}`;
  const actor = command.isProtected ? [`systemActor('${jobName}')`] : [];
  const grant = command.isProtected ? grantSystemActor(scope, jobName, command) : undefined;

  return {
    name: jobName,
    schedule,
    switch: `JOB_${scope.context.constant}_${name.constant}_ENABLED`,
    command: command.name.pascal,
    commandKebab: command.name.kebab,
    commandWords: command.name.words,
    protected: command.isProtected,
    asActor: command.isProtected ? ' as the system actor of the job' : '',
    kernelImport: command.isProtected
      ? "import { systemActor, type CommandBus } from '@ddd-ts-kit/kernel';"
      : "import type { CommandBus } from '@ddd-ts-kit/kernel';",
    systemActorValueImport: command.isProtected ? 'systemActor, ' : '',
    arguments: [...actor, ...(command.takesInstant ? ['execution.scheduledAt'] : [])].join(', '),
    todo: todoOf(command),
    ...grantedInSpec(scope, command),
    ungranted: grant?.isWritten === false,
    grant: grant?.todo ?? '',
  };
}

function todoOf(command: SentCommand): string {
  const message = `${command.name.pascal}Command`;

  return command.takesInstant
    ? `hand ${message} the other data it needs once its constructor declares them; ${PERIOD}.`
    : `give ${message} a constructor parameter for the instant the work is for and pass it \`execution.scheduledAt\`; ${PERIOD}.`;
}

/** What the spec gives the system actor of the job, so that the guard lets its command through: the permission of the command, read where it is written. */
function grantedInSpec(scope: Scope, command: SentCommand): RenderContext {
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
