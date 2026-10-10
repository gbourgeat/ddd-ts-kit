import { CliError } from '../../../cli-error.js';
import type { Name } from '../../../naming/index.js';
import type { KindFlags } from '../../kind.js';
import { requireFile } from '../../require-file.js';
import type { Scope } from '../../scope.js';
import type { UseCase } from './use-case.js';

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
function shapeOf(source: string, isQuery: boolean): Pick<UseCase, 'returnsId' | 'isProtected' | 'isSearch'> {
  return {
    // A command that answers an identifier is declared `extends Command<string>` or `extends AuthorizedCommand<string>`.
    returnsId: !isQuery && /extends\s+(?:Authorized)?Command<\s*string\s*>/.test(source),
    isProtected: /extends\s+Authorized(?:Command|Query)\b/.test(source),
    isSearch: isQuery && /\breadonly page: PageRequest</.test(source),
  };
}
