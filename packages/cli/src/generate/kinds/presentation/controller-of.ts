import { CliError } from '../../../cli-error';
import type { Name } from '../../../naming';
import { filesUnder } from '../../files-under';
import type { Scope } from '../../scope';

/** A controller of the context, found by its use case, with its source as it stands. */
export interface FoundController {
  readonly file: string;
  readonly source: string;
}

/** The controller of a use case, wherever its resource folder is under presentation/http/. */
export function controllerOf(scope: Scope, useCase: Name): FoundController {
  const http = `${scope.dir}/presentation/http`;

  const found = filesUnder(scope.ws, http).find((file) =>
    file.endsWith(`/${useCase.kebab}/${useCase.kebab}.controller.ts`),
  );

  const source = found === undefined ? undefined : scope.ws.read(`${http}/${found}`);

  if (found === undefined || source === undefined || !source.includes('@Controller(')) {
    throw new CliError(
      `The context ${scope.context.kebab} has no controller for ${useCase.title}.`,
      `Write it first: \`ddd-ts-kit generate controller ${scope.context.kebab} ${useCase.pascal}\`; a function route declares \`produces\` and \`form\` in its \`defineRoute\` spec by hand.`,
    );
  }

  return { file: `${http}/${found}`, source };
}
