import type { Name } from '../../../naming';
import { filesUnder } from '../../files-under';
import { prerequisiteRefusal } from '../../prerequisite-refusal';
import type { Scope } from '../../scope';
import { roleFoldersOf, treeOf } from '../../../model-modules';

/** A controller of the context, found by its use case, with its source as it stands. */
export interface FoundController {
  readonly file: string;
  readonly source: string;
}

/** The controller of a use case, wherever its resource folder is under presentation/http/, in the context or in a module. */
export function controllerOf(scope: Scope, useCase: Name): FoundController {
  const found = roleFoldersOf(scope.ws, treeOf(scope.config, scope.context.kebab), 'presentation/http')
    .flatMap((http) => filesUnder(scope.ws, http).map((file) => `${http}/${file}`))
    .find((file) => file.endsWith(`/${useCase.kebab}/${useCase.kebab}.controller.ts`));

  const source = found === undefined ? undefined : scope.ws.read(found);

  if (found === undefined || source === undefined || !source.includes('@Controller(')) {
    // No controller yet is one an earlier command writes; a function route is a choice of the team.
    throw prerequisiteRefusal(
      found === undefined,
      `The context ${scope.context.kebab} has no controller for ${useCase.title}.`,
      `Write it first: \`ddd-ts-kit generate controller ${scope.context.kebab} ${useCase.pascal}\`; a function route declares \`produces\` and \`form\` in its \`defineRoute\` spec by hand.`,
    );
  }

  scope.flags.builtOn?.(found);

  return { file: found, source };
}
