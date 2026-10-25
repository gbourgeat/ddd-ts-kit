import { emit, type Output } from '../../emit';
import { named } from '../../named';
import type { Scope } from '../../scope';
import { vars } from '../../vars';
import { wire } from '../../wire';
import type { ControllerPlan } from './controller-plan';
import { dtoClasses } from './dto-classes';
import { groupVars } from './group-vars';
import { nestControllerVars } from './nest-controller-vars';
import { nestSearchVars } from './nest-search-vars';
import { sharesSchemas } from './shares-schemas';

/**
 * Writes a Nest controller in its folder, its DTO classes beside it, its spec and its group when it
 * is new, and lists it in the module of its context, for Nest to build it and the kit to serve it.
 */
export function writeNestController(scope: Scope, plan: ControllerPlan): void {
  assertWritable(scope);

  const { name, group } = plan;

  const context = vars(scope, {
    name: named(name),
    route: nestControllerVars(scope, { ...plan, withMapper: false, withSerializer: false }),
    ...(plan.useCase.isSearch ? { search: nestSearchVars(name, plan) } : {}),
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

  emit(scope, context, outputsOf(scope, plan));
  wire(scope, 'nest-controller', context);
}

/** The method of a Nest controller maps its input and its answer itself. */
function assertWritable(scope: Scope): void {
  if (scope.flags.mapper || scope.flags.serializer) {
    scope.ws.note(
      '--mapper and --serializer are left out: the method of a Nest controller maps its input and its answer itself.',
    );
  }
}

function outputsOf(scope: Scope, { name, group, useCase, endpoint, folder }: ControllerPlan): Output[] {
  const beside = (role: string): string => `${folder}/${name.kebab}.${role}.ts`;

  return [
    ...(group === undefined || group.exists ? [] : [['controller/group.ts.tpl', `${group.file}.ts`] satisfies Output]),
    [`nest-controller/controller${useCase.isSearch ? '.search' : ''}.ts.tpl`, beside('controller')],
    ...dtoClasses(endpoint, useCase, sharesSchemas(scope.config)).map(
      (role): Output => [`route/dto.${role}.ts.tpl`, beside(role)],
    ),
    ['nest-controller/controller.spec.ts.tpl', `test/unit/${name.kebab}.controller.spec.ts`],
  ];
}
