import type { RenderContext } from '../../../templating';
import type { Scope } from '../../scope';
import { controllerImports, type ControllerImports } from './controller-imports';
import type { ControllerPlan } from './controller-plan';
import { controllerTypes, type ControllerTypes } from './controller-types';
import type { MessagePlan } from './message-plan';
import { planOf } from './plan-of';
import { routeVars } from './route-vars';
import { sharesSchemas } from './shares-schemas';
import { messageCall } from './message-call';
import { NOTHING_READ } from './message-plan';

/** What the templates of a controller read, over what the templates of a route read: its group, its types and its neighbours. */
export function controllerVars(scope: Scope, plan: ControllerPlan): RenderContext {
  const { useCase, withMapper, withSerializer } = plan;
  const reading = planOf(scope, plan, withMapper);
  const types = controllerTypes(scope, plan, reading);
  const imports = controllerImports(scope, plan);
  const readsRequest = useCase.isProtected || withMapper || reading.read.length > 0;

  return {
    ...routeVars(scope, plan, reading),
    ...declarationVars(scope, plan, readsRequest),
    ...neighbourVars(scope, plan),
    ...handleVars(plan, { types, reading }, readsRequest),
    mapper: withMapper,
    serializer: withSerializer,
    imports: lines(controllerFileImports(plan, imports)),
    ...mapperVars(plan, { types, imports }),
    ...serializerVars(types, imports),
  };
}

/** What `handle` reads, sends and answers. */
function handleVars(
  { useCase, withMapper }: ControllerPlan,
  { types, reading }: { readonly types: ControllerTypes; readonly reading: MessagePlan },
  readsRequest: boolean,
): RenderContext {
  const message = messageCall(useCase, reading, {
    actor: 'request.actor',
    field: (field) => `request.${field.from}.${field.name}`,
  });

  const answers = declaresAnswer(useCase, types);

  return {
    hasTypedParams: types.hasTypedParams,
    declaresSchema: types.hasTypedParams || types.hasBody || answers,
    usesInfer: !types.usesClasses && ((readsRequest && types.parts.length > 0) || answers),
    requestParam: readsRequest ? `request: ${types.request}` : '',
    message: withMapper ? 'this.mapper.map(request)' : message,
    acceptedType: types.accepted,
    answerType: types.answer,
  };
}

/** A shared identifier answer is a schema of the platform: the controller declares none for it. */
function declaresAnswer(useCase: ControllerPlan['useCase'], types: ControllerTypes): boolean {
  return useCase.isQuery || (useCase.returnsId && types.accepted !== 'Accepted');
}

function declarationVars(scope: Scope, plan: ControllerPlan, readsRequest: boolean): RenderContext {
  const { endpoint, group, cache } = plan;
  const rest = group === undefined ? endpoint.path : endpoint.path.slice(group.prefix.length);

  return {
    access:
      group === undefined
        ? `tags: ['${scope.context.kebab}'],\n  guards: [Public],`
        : `group: ${group.name.pascal}Routes,`,
    groupPath: rest === '' ? '/' : rest,
    httpImports: httpImports(scope, plan, readsRequest).join(', '),
    cached: cache !== undefined,
    cache: cache ?? '',
  };
}

/** What the controller imports from `@ddd-ts-kit/http`, in the order the formatter keeps. */
function httpImports(scope: Scope, { useCase, group, cache }: ControllerPlan, readsRequest: boolean): string[] {
  const sharedAccepted = useCase.returnsId && sharesSchemas(scope.config);

  return [
    ...(sharedAccepted ? ['acceptedSchema'] : []),
    ...(cache === undefined ? [] : ['CacheScope']),
    'Controller',
    ...(group === undefined ? ['Public'] : []),
    ...(sharedAccepted ? ['type Accepted'] : []),
    ...(readsRequest ? ['type HttpRequest'] : []),
  ];
}

function controllerFileImports({ withMapper, withSerializer }: ControllerPlan, imports: ControllerImports): string[] {
  return [
    ...(withMapper ? [] : [imports.message]),
    ...imports.group,
    ...imports.dtos,
    ...(withMapper ? [typeOnly(imports.mapper)] : []),
    ...(withSerializer ? [typeOnly(imports.serializer)] : []),
  ];
}

interface Written {
  readonly types: ControllerTypes;
  readonly imports: ControllerImports;
}

function mapperVars({ useCase }: ControllerPlan, { types, imports }: Written): RenderContext {
  const usedTypes = types.usesClasses
    ? [...(types.hasTypedParams ? ['params'] : []), ...(types.hasBody ? ['body'] : [])].map((role) =>
        imports.typeOf(role),
      )
    : [];

  return {
    mapperRequest: types.mapperRequest,
    mapperImports: lines([imports.message, ...usedTypes]),
    messageKind: useCase.isQuery ? 'query' : 'command',
    actorNote: useCase.isProtected ? '; the actor is already there' : '',
    mapperMessage: messageCall(useCase, NOTHING_READ, { actor: 'request.actor' }),
  };
}

function serializerVars(types: ControllerTypes, imports: ControllerImports): RenderContext {
  return {
    resultType: imports.result.replace(/^import type \{ (\w+) \}.*$/, '$1'),
    serializedType: types.usesClasses ? types.answer : 'Record<string, never>',
    serializerImports: lines([imports.result, ...(types.usesClasses ? [imports.typeOf('answer')] : [])]),
  };
}

/** What the spec and the hand-written wiring build the controller with. */
function neighbourVars(scope: Scope, plan: ControllerPlan): RenderContext {
  const { useCase, name } = plan;
  const imports = controllerImports(scope, plan);
  const bus = useCase.isQuery ? 'queries' : 'commands';
  const scheme = scope.config.stack.authn === 'none' ? ", { security: ['developmentActor'] }" : '';

  const beside = besideOf(plan, imports);

  const injected = [
    `private readonly ${bus}: ${useCase.isQuery ? 'QueryBus' : 'CommandBus'}`,
    ...beside.map(({ member, type }) => `private readonly ${member}: ${name.pascal}${type}`),
  ];

  const built = beside.map((neighbour) => neighbour.built);
  const listed = lines([imports.controller, ...beside.map((neighbour) => neighbour.import)]);

  return {
    // The formatter gives each parameter property its line as soon as there are two.
    constructorParams:
      injected.length === 1 ? injected.join('') : `\n${injected.map((one) => `    ${one},\n`).join('')}  `,
    specImports: listed,
    specArguments: [bus, ...built].join(', '),
    wiringImports: listed,
    wiringArguments: `${[bus, ...built].join(', ')})]${scheme}`,
    platformArguments: `${[`platform.${bus}`, ...built].join(', ')})]${scheme}`,
  };
}

interface Neighbour {
  readonly import: string;
  readonly built: string;
  readonly member: string;
  readonly type: string;
}

/** The mapper and the serializer a controller is given, when it has them. */
function besideOf({ name, withMapper, withSerializer }: ControllerPlan, imports: ControllerImports): Neighbour[] {
  const mapper = { import: imports.mapper, built: `new ${name.pascal}Mapper()`, member: 'mapper', type: 'Mapper' };
  const serializer = { ...mapper, import: imports.serializer, built: `new ${name.pascal}Serializer()` };

  return [
    ...(withMapper ? [mapper] : []),
    ...(withSerializer ? [{ ...serializer, member: 'serializer', type: 'Serializer' }] : []),
  ];
}

function typeOnly(statement: string): string {
  return statement.replace(/^import \{/, 'import type {');
}

function lines(statements: readonly string[]): string {
  return statements.join('\n');
}
