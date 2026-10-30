import type { Name } from '../../../naming';
import type { RenderContext } from '../../../templating';
import type { Scope } from '../../scope';
import { grantedInSpec } from '../job/granted-in-spec';
import type { SentCommand } from '../job/sent-command';
import { jobImport } from './job-import';
import { payloadFieldOf } from './payload-field';
import { payloadSchemaOf } from './payload-schema-of';
import type { PayloadSchema } from './payload-schema';

const SPEC_INDENT = '      ';

/** What every background job imports of the kernel. */
const KERNEL_TYPES = ['type BackgroundJob', 'type BackgroundJobExecution', 'type CommandBus'];

/** What the templates of a background job read: its name, its payload, and how it builds the command it sends. */
export function backgroundJobVars(scope: Scope, name: Name, command: SentCommand): RenderContext {
  const jobName = `${scope.context.kebab}.${name.kebab}`;
  const fields = command.inputs.map((input) => payloadFieldOf(command.name, input));
  const actor = command.isProtected ? ['execution.actor'] : [];
  const hasPayload = fields.length > 0;
  const schema = payloadSchemaOf(scope, { name, vendor: scope.context.kebab, fields });

  return {
    ...importsOf(schema),
    payloadDeclaration: schema.declaration,
    payloadSchema: schema.schema,
    payloadHelpers: schema.helpers,
    hasPayloadHelpers: schema.helpers !== '',
    misfit: fields.some((field) => !field.optional) ? '{}' : "'a payload of an earlier shape'",
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

/** The library above the kernel, `@ddd-ts-kit/validation` below it, as the formatter of the project sorts them. */
function importsOf(schema: PayloadSchema): RenderContext {
  const values = schema.kernelNames.filter((name) => !name.startsWith('type '));
  const types = [...schema.kernelNames.filter((name) => name.startsWith('type ')), ...KERNEL_TYPES].sort();
  const kernel = [...values, ...types];
  const names = values.length > 0 ? kernel.join(', ') : kernel.map((name) => name.replace(/^type /, '')).join(', ');

  return {
    libraryImports: schema.libraryImports.join('\n'),
    hasLibraryImports: schema.libraryImports.length > 0,
    kernelImport: `import ${values.length > 0 ? '' : 'type '}{ ${names} } from '@ddd-ts-kit/kernel';`,
    kitImports: schema.kitImports.join('\n'),
    hasKitImports: schema.kitImports.length > 0,
  };
}
