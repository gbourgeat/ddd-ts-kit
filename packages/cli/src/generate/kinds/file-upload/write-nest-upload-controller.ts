import type { RenderContext } from '../../../templating';
import { emit, type Output } from '../../emit';
import { named } from '../../named';
import type { Scope } from '../../scope';
import { vars } from '../../vars';
import { controllerImports } from '../route/controller-imports';
import type { ControllerPlan } from '../route/controller-plan';
import { groupVars } from '../route/group-vars';
import { nestControllerVars } from '../route/nest-controller-vars';

/**
 * Writes the Nest controller of an upload in its folder, its group when it is new, and its spec:
 * `@Upload()` hands its method the file the kit streams, and the generated list of the context
 * names it for Nest to build.
 */
export function writeNestUploadController(scope: Scope, plan: ControllerPlan): void {
  const { name, group, folder } = plan;
  const route = nestControllerVars(scope, { ...plan, withMapper: false, withSerializer: false });

  // The file is the request: no class of params, body or answer stands next to the controller.
  const { message, group: groupImport } = controllerImports(scope, plan);

  const context = vars(scope, {
    name: named(name),
    route: { ...route, imports: [message, ...groupImport].join('\n') },
    upload: uploadVars(plan),
    ...(group === undefined
      ? {}
      : {
          group: groupVars({
            name: group.name,
            prefix: group.prefix,
            tag: scope.context.kebab,
            access: 'authenticated',
          }),
        }),
  });

  const outputs: Output[] = [
    ...(group === undefined || group.exists ? [] : [['controller/group.ts.tpl', `${group.file}.ts`] satisfies Output]),
    ['nest-controller/upload.ts.tpl', `${folder}/${name.kebab}.controller.ts`],
    ['nest-controller/upload.spec.ts.tpl', `test/unit/${name.kebab}.controller.spec.ts`],
  ];

  emit(scope, context, outputs);
}

/** The imports of the controller, and the parameters of its method: the file, and the caller of a protected use case. */
function uploadVars({ group, useCase }: ControllerPlan): RenderContext {
  return {
    kitImports: [...(group === undefined ? ['Public'] : []), 'type IncomingFile'].join(', '),
    bridgeImports: [...(useCase.isProtected ? ['CurrentActor'] : []), 'KitRoute', 'KitRoutes', 'Upload'].join(', '),
    kernelImports: useCase.isProtected ? 'CommandBus, type Actor' : 'CommandBus',
    parameters: ['@Upload() file: IncomingFile', ...(useCase.isProtected ? ['@CurrentActor() actor: Actor'] : [])].join(
      ', ',
    ),
    arguments: useCase.isProtected ? 'actor, file' : 'file',
  };
}
