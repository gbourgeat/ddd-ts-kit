import type { Name } from '../../../naming';
import type { RenderContext } from '../../../templating';
import type { Scope } from '../../scope';
import { grantSystemActor } from './grant-system-actor';
import { grantedInSpec } from './granted-in-spec';
import type { SentCommand } from './sent-command';

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
