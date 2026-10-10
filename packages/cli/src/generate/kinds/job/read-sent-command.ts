import { CliError } from '../../../cli-error.js';
import type { Name } from '../../../naming/index.js';
import { concept } from '../../concept.js';
import { requireFile } from '../../require-file.js';
import type { Scope } from '../../scope.js';
import { constructorParameters } from './constructor-parameters.js';
import type { SentCommand } from './sent-command.js';

const OPTIONAL = /^[^:=]*\?\s*:|=/;
const INSTANT = /:\s*Date\b/;

/** The command `--command` names: it has to exist, and a job has to be able to build it from what it knows. */
export function readSentCommand(scope: Scope, input: string): SentCommand {
  const name = concept({ ...scope, flags: { ...scope.flags, allowName: true } }, input, { what: 'use case', strip: ['command', 'handler'] });
  const file = `application/commands/${name.kebab}/${name.kebab}.command.ts`;

  requireFile(scope, { file, what: `The command ${name.pascal}`, createdBy: `ddd-ts-kit generate command ${scope.context.kebab} ${name.pascal} --permission <aggregate>.<action>` });

  const source = withoutComments(scope.ws.read(`${scope.dir}/${file}`) ?? '');
  const isProtected = /extends\s+AuthorizedCommand\b/.test(source);
  const [first = '', ...others] = constructorParameters(source).slice(isProtected ? 1 : 0);
  const takesInstant = INSTANT.test(first);

  refuseUnknownInput(scope, name, [...(takesInstant ? [] : [first]), ...others]);

  return { name, isProtected, permission: isProtected ? requiredPermission(scope, name, source) : undefined, takesInstant };
}

/** A generated command describes its constructor in a `TODO(domain)` comment before it has one. */
function withoutComments(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

/** A job knows its actor and the instant it was due, nothing else: a command that needs more cannot be built by it. */
function refuseUnknownInput(scope: Scope, name: Name, parameters: readonly string[]): void {
  const unknown = parameters.filter((parameter) => parameter !== '' && !OPTIONAL.test(parameter)).map(nameOf);

  if (unknown.length === 0) return;

  throw new CliError(
    `The constructor of ${name.pascal}Command needs ${unknown.map((parameter) => `\`${parameter}\``).join(', ')}, which a job cannot know.`,
    `A job only says that the time has come: it sends a command that takes its actor and, at most, the instant the work is for (\`readonly dueBefore: Date\`), and the handler finds what to act on. Create that use case with \`ddd-ts-kit generate command ${scope.context.kebab} <UseCaseName>\` and pass it to --command, or make ${unknown.length === 1 ? 'this parameter' : 'these parameters'} optional.`,
  );
}

function nameOf(parameter: string): string {
  return /([A-Za-z_$][\w$]*)\s*\??\s*(?::|$)/.exec(parameter)?.[1] ?? parameter;
}

/** Read where the style of the project writes it: on the command itself, or next to its registration in the module file. */
function requiredPermission(scope: Scope, name: Name, source: string): string | undefined {
  const module = scope.ws.read(`${scope.dir}/${scope.context.kebab}.module.ts`) ?? '';
  const registered = new RegExp(`\\b${name.pascal}Command\\b[^;\\n]*?Permissions\\['([^']+)'\\]`).exec(module)?.[1];
  const declared = /@Requires\(\s*\w+Permissions\['([^']+)'\]/.exec(source)?.[1];
  const permission = declared ?? registered;

  return permission === undefined ? undefined : `${scope.context.kebab}:${permission}`;
}
