import type { Name } from '../../../naming/index.js';
import type { RenderContext } from '../../../templating/index.js';
import type { Scope } from '../../scope.js';
import { grantedInSpec } from '../job/granted-in-spec.js';
import type { SentCommand } from '../job/sent-command.js';
import { jobImport } from './job-import.js';
import { payloadFieldOf } from './payload-field.js';

const SPEC_INDENT = '      ';

/** What the templates of a background job read: its name, its payload, and how it builds the command it sends. */
export function backgroundJobVars(scope: Scope, name: Name, command: SentCommand): RenderContext {
  const jobName = `${scope.context.kebab}.${name.kebab}`;
  const fields = command.inputs.map((input) => payloadFieldOf(command.name, input));
  const actor = command.isProtected ? ['execution.actor'] : [];
  const hasPayload = fields.length > 0;

  return {
    name: jobName,
    command: command.name.pascal,
    commandKebab: command.name.kebab,
    commandWords: command.name.words,
    protected: command.isProtected,
    hasPayload,
    specImport: jobImport(scope, name, hasPayload),
    payloadFields: fields.map((field) => field.declaration).join('\n'),
    payloadSample: fields.map((field) => `${SPEC_INDENT}${field.sample}`).join('\n'),
    arguments: [...actor, ...fields.map((field) => field.argument)].join(', '),
    asActor: command.isProtected ? ' as the actor that enqueued the job' : '',
    todo: hasPayload
      ? 'each run may be a retry, so the use case it sends is safe to repeat; a long run reports its progress and saves a checkpoint between two commands.'
      : `hand ${command.name.pascal}Command what it needs from the payload once its constructor declares it; each run may be a retry, so the use case it sends is safe to repeat.`,
    ...grantedInSpec(scope, command),
  };
}
