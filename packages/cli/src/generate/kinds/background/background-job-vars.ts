import type { Name } from '../../../naming/index.js';
import type { RenderContext } from '../../../templating/index.js';
import type { Scope } from '../../scope.js';
import { grantedInSpec } from '../job/granted-in-spec.js';
import type { SentCommand } from '../job/sent-command.js';

/** What the templates of a background job read: its name, and how it builds the command it sends. */
export function backgroundJobVars(scope: Scope, name: Name, command: SentCommand): RenderContext {
  const jobName = `${scope.context.kebab}.${name.kebab}`;
  const actor = command.isProtected ? ['execution.actor'] : [];
  const instant = command.takesInstant ? ['execution.enqueuedAt'] : [];
  const message = `${command.name.pascal}Command`;

  return {
    name: jobName,
    command: command.name.pascal,
    commandKebab: command.name.kebab,
    commandWords: command.name.words,
    protected: command.isProtected,
    arguments: [...actor, ...instant].join(', '),
    asActor: command.isProtected ? ' as the actor that enqueued the job' : '',
    todo: `hand ${message} what it needs from the payload once its constructor declares it; each run may be a retry, so the use case it sends is safe to repeat.`,
    ...grantedInSpec(scope, command),
  };
}
