import { emit, type Output } from '../../emit.js';
import { named } from '../../named.js';
import type { Scope } from '../../scope.js';
import { vars } from '../../vars.js';
import { wire } from '../../wire.js';
import type { ControllerPlan } from './controller-plan.js';
import { controllerVars } from './controller-vars.js';
import { dtoClasses } from './dto-classes.js';
import { groupVars } from './group-vars.js';
import { sharesSchemas } from './shares-schemas.js';
import { SEARCH_LINE_LIBRARIES } from './search-line-libraries.js';

/** Writes a controller in its folder, with its schemas, its mapper and serializer when asked, its spec and its group when it is new. */
export function writeController(scope: Scope, plan: ControllerPlan): void {
  const { name, group } = plan;
  const { validation } = scope.config.stack;

  const context = vars(scope, {
    name: named(name),
    route: controllerVars(scope, plan),
    search: { customSchema: !SEARCH_LINE_LIBRARIES.has(validation) },
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

  if (scope.flags.mapper && !plan.withMapper) {
    scope.ws.note(`--mapper is left out: the controller of a search hands the page over itself.`);
  }

  if (scope.flags.serializer && !plan.withSerializer) {
    scope.ws.note(`--serializer is left out: only the controller of a plain query has a result to serialize.`);
  }

  emit(scope, context, [
    ...(group === undefined || group.exists ? [] : [groupOutput(group.file)]),
    ...controllerOutputs(scope, plan),
    ['controller/controller.spec.ts.tpl', `test/unit/${name.kebab}.controller.spec.ts`],
  ]);

  wire(scope, 'controller', context);
}

function groupOutput(file: string): Output {
  return ['controller/group.ts.tpl', `${file}.ts`];
}

function controllerOutputs(scope: Scope, plan: ControllerPlan): Output[] {
  const { name, endpoint, useCase, folder, withMapper, withSerializer } = plan;
  const { validation } = scope.config.stack;
  const dtos = validation === 'class-validator' ? dtoClasses(endpoint, useCase, sharesSchemas(scope.config)) : [];
  const beside = (role: string): string => `${folder}/${name.kebab}.${role}.ts`;

  return [
    [`controller/controller.${useCase.isSearch ? 'search' : validation}.ts.tpl`, beside('controller')],
    ...dtos.map((role): Output => [`route/dto.${role}.ts.tpl`, beside(role)]),
    ...(withMapper ? [['controller/mapper.ts.tpl', beside('mapper')] satisfies Output] : []),
    ...(withSerializer ? [['controller/serializer.ts.tpl', beside('serializer')] satisfies Output] : []),
  ];
}
