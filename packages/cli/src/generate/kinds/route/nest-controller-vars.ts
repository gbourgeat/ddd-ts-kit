import type { RenderContext } from '../../../templating';
import type { Scope } from '../../scope';
import type { ControllerPlan } from './controller-plan';
import { controllerTypes, type ControllerTypes } from './controller-types';
import { controllerVars } from './controller-vars';
import { sharesSchemas } from './shares-schemas';

/**
 * What the template of a Nest controller reads, over what the template of a controller of the kit
 * reads: the decorators of Nest it is written with, the parameters of its method, and the bus Nest
 * injects by its class.
 */
export function nestControllerVars(scope: Scope, plan: ControllerPlan): RenderContext {
  const types = controllerTypes(scope, plan);

  return {
    ...controllerVars(scope, plan),
    ...importVars(scope, plan, types),
    ...declarationVars(scope, plan),
    ...methodVars(plan, types),
  };
}

function importVars(scope: Scope, plan: ControllerPlan, types: ControllerTypes): RenderContext {
  const { useCase, endpoint } = plan;
  const fromTheKit = kitImportsOf(scope, plan);

  const fromNest = [
    ...(types.hasBody ? ['Body'] : []),
    'Controller',
    decoratorOf(endpoint.method),
    'Inject',
    ...(types.hasTypedParams ? ['Param'] : []),
  ];

  const busType = busTypeOf(useCase.isQuery);

  return {
    nestImports: fromNest.sort().join(', '),
    importsFromTheKit: fromTheKit.length > 0,
    kitImports: fromTheKit.join(', '),
    bridgeImports: [...(useCase.isProtected ? ['CurrentActor'] : []), 'KitRoute', 'KitRoutes'].join(', '),
    kernelImports: useCase.isProtected ? `${busType}, type Actor` : busType,
  };
}

/** What the controller imports from `@ddd-ts-kit/http`, in the order the formatter keeps. */
function kitImportsOf(scope: Scope, { useCase, group, cache }: ControllerPlan): string[] {
  const sharedAccepted = useCase.returnsId && sharesSchemas(scope.config);

  return [
    ...(sharedAccepted ? ['acceptedSchema'] : []),
    ...(cache === undefined ? [] : ['CacheScope']),
    ...(group === undefined ? ['Public'] : []),
    ...(sharedAccepted ? ['type Accepted'] : []),
  ];
}

/** What the class and the decorator of its method say: the group, the method of Nest and the path after the prefix. */
function declarationVars(scope: Scope, { group, endpoint }: ControllerPlan): RenderContext {
  const rest = (group === undefined ? endpoint.path : endpoint.path.slice(group.prefix.length)).replace(/^\//, '');

  return {
    nestMethod: decoratorOf(endpoint.method),
    nestPath: rest === '' ? '' : `'${rest}'`,
    nestShared:
      group === undefined ? `tags: ['${scope.context.kebab}'], guards: [Public]` : `group: ${group.name.pascal}Routes`,
  };
}

/** What the method reads, and the message it sends through the bus the constructor injects. */
function methodVars({ name, useCase }: ControllerPlan, types: ControllerTypes): RenderContext {
  const busType = busTypeOf(useCase.isQuery);

  return {
    readsRequest: types.hasTypedParams || types.hasBody,
    nestRequest: [
      ...(types.hasTypedParams ? ['params: paramsSchema'] : []),
      ...(types.hasBody ? ['body: bodySchema'] : []),
    ].join(', '),
    nestParameters: [
      ...(types.hasTypedParams ? [`@Param() params: ${name.pascal}Params`] : []),
      ...(types.hasBody ? [`@Body() body: ${name.pascal}Body`] : []),
      ...(useCase.isProtected ? ['@CurrentActor() actor: Actor'] : []),
    ].join(', '),
    nestConstructor: `@Inject(${busType}) private readonly ${useCase.isQuery ? 'queries' : 'commands'}: ${busType}`,
    nestMessage: `new ${useCase.message}(${useCase.isProtected ? 'actor' : ''})`,
  };
}

/** `POST` read as the decorator of Nest that declares it: `Post`. */
function decoratorOf(method: string): string {
  return `${method.charAt(0)}${method.slice(1).toLowerCase()}`;
}

function busTypeOf(isQuery: boolean): string {
  return isQuery ? 'QueryBus' : 'CommandBus';
}
