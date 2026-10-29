import { CliError } from '../../../cli-error';
import type { Name } from '../../../naming';
import type { KindFlags } from '../../kind';
import { requireFile } from '../../require-file';
import type { Scope } from '../../scope';
import { messageFieldsOf } from './message-fields-of';
import type { UseCase } from './use-case';

type MessageKind = 'command' | 'query';

/** The command or the query of the name, whichever exists, unless `--command` or `--query` says which. */
export function findUseCase(scope: Scope, name: Name, flags: KindFlags): UseCase {
  if (flags.command && flags.query) {
    throw new CliError('--command and --query exclude each other.', 'Keep the one matching the use case.');
  }

  const file = (kind: MessageKind): string =>
    `application/${kind === 'query' ? 'queries' : 'commands'}/${name.kebab}/${name.kebab}.${kind}`;

  const has = (kind: MessageKind): boolean => scope.ws.exists(`${scope.dir}/${file(kind)}.ts`);
  const isQuery = flags.query || (!flags.command && !has('command') && has('query'));
  const kind = isQuery ? 'query' : 'command';

  requireFile(scope, {
    file: `${file(kind)}.ts`,
    what: `The ${kind} ${name.pascal}`,
    createdBy: `ddd-ts-kit generate ${kind} ${scope.context.kebab} ${name.pascal}`,
  });

  return {
    isQuery,
    message: `${name.pascal}${isQuery ? 'Query' : 'Command'}`,
    messageFile: file(kind),
    ...shapeOf(scope.ws.read(`${scope.dir}/${file(kind)}.ts`) ?? '', isQuery),
  };
}

/** What the source of the message says about it, read from its declaration. */
function shapeOf(source: string, isQuery: boolean): Pick<UseCase, 'returnsId' | 'isProtected' | 'isSearch' | 'fields'> {
  const isProtected = /extends\s+Authorized(?:Command|Query)\b/.test(source);

  return {
    fields: messageFieldsOf(source, isProtected),
    // A command that answers an identifier is declared `extends Command<string>` or `extends AuthorizedCommand<string>`.
    returnsId: !isQuery && /extends\s+(?:Authorized)?Command<\s*string\s*>/.test(source),
    isProtected,
    isSearch: isQuery && /\breadonly page: PageRequest</.test(source),
  };
}
