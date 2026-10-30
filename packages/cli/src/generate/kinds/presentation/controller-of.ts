import type { CliError } from '../../../cli-error';
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
  const files = roleFoldersOf(scope.ws, treeOf(scope.config, scope.context.kebab), 'presentation/http').flatMap(
    (http) => filesUnder(scope.ws, http).map((file) => `${http}/${file}`),
  );

  const found = files.find((file) => file.endsWith(`/${useCase.kebab}/${useCase.kebab}.controller.ts`));
  const source = found === undefined ? undefined : scope.ws.read(found);

  if (found === undefined || source === undefined || !source.includes('@Controller(')) {
    const routed = found !== undefined || files.some((file) => file.endsWith(`/${useCase.kebab}.route.ts`));

    throw noController(scope, useCase, routed);
  }

  scope.flags.builtOn?.(found);

  return { file: found, source };
}

/**
 * No route at all is one an earlier command writes; a route written as a function, or a file of
 * the name that holds no controller class, is a choice of the team, which a command does not undo.
 */
function noController(scope: Scope, useCase: Name, routed: boolean): CliError {
  const { kebab } = scope.context;
  const controller = `\`ddd-ts-kit generate controller ${kebab} ${useCase.pascal} --method <M> --path <path>\``;

  return prerequisiteRefusal(
    !routed,
    `The context ${kebab} has no controller for ${useCase.title}.`,
    routed
      ? `Its route is not a controller class: write one with ${controller}, or declare \`produces\` and \`form\` in its \`defineRoute\` by hand.`
      : `Write it first: \`ddd-ts-kit generate route ${kebab} ${useCase.pascal} --method <M> --path <path>\` under "stack.routes": "controllers" or "nest", or ${controller}.`,
  );
}
