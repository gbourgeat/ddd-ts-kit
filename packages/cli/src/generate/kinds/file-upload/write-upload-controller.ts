import { emit, type Output } from '../../emit.js';
import { named } from '../../named.js';
import type { Scope } from '../../scope.js';
import { vars } from '../../vars.js';
import { wire } from '../../wire.js';
import { controllerImports } from '../route/controller-imports.js';
import type { ControllerPlan } from '../route/controller-plan.js';
import { controllerVars } from '../route/controller-vars.js';
import { groupVars } from '../route/group-vars.js';

/** Writes the controller of an upload in its folder, its group when it is new, and its spec; registers it where controllers are listed. */
export function writeUploadController(scope: Scope, plan: ControllerPlan): void {
  const { name, group, folder } = plan;

  const httpImports = [
    'Controller',
    ...(group === undefined ? ['Public'] : []),
    'type HttpRequest',
    'type IncomingFile',
  ];

  // The file is the request: no schema of params, body or answer stands next to the controller.
  const { message, group: groupImport } = controllerImports(scope, plan);

  const context = vars(scope, {
    name: named(name),
    route: { ...controllerVars(scope, plan), imports: [message, ...groupImport].join('\n') },
    upload: { httpImports: httpImports.join(', ') },
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
    ['file-upload/controller.ts.tpl', `${folder}/${name.kebab}.controller.ts`],
    ['file-upload/controller.spec.ts.tpl', `test/unit/${name.kebab}.controller.spec.ts`],
  ];

  emit(scope, context, outputs);
  wire(scope, 'controller', context);
}
