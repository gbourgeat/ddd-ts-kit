import type { Scope } from '../../scope';
import type { ControllerPlan } from './controller-plan';
import { sharesSchemas } from './shares-schemas';

const WITH_BODY = ['POST', 'PUT', 'PATCH'];

/** The types a controller and its mapper name: classes with class-validator, the output of the schemas otherwise. */
export interface ControllerTypes {
  /** The parts of the request the controller declares a schema for, each with its type. */
  readonly parts: readonly string[];
  /** `HttpRequest`, narrowed to those parts. */
  readonly request: string;
  /** The request as a mapper names it, in a file that cannot see the schemas of the controller. */
  readonly mapperRequest: string;
  readonly accepted: string;
  readonly answer: string;
  readonly usesClasses: boolean;
  readonly hasTypedParams: boolean;
  readonly hasBody: boolean;
}

export function controllerTypes(scope: Scope, { name, endpoint }: ControllerPlan): ControllerTypes {
  const { validation } = scope.config.stack;
  const shared = sharesSchemas(scope.config);
  const usesClasses = validation === 'class-validator';
  const hasBody = WITH_BODY.includes(endpoint.method);

  const hasTypedParams =
    endpoint.parameters.length > 0 && (validation === 'zod' || validation === 'typebox' || usesClasses);

  const typeOf = (part: string, role: string): string =>
    usesClasses ? `${name.pascal}${role}` : `Infer<typeof ${part}>`;

  const parts = [
    ...(hasTypedParams ? [`params: ${typeOf('params', 'Params')}`] : []),
    ...(hasBody ? [`body: ${typeOf('body', 'Body')}`] : []),
  ];

  const looseParts = hasBody ? ['body: Record<string, unknown>'] : [];

  return {
    parts,
    request: narrowed(parts),
    mapperRequest: narrowed(usesClasses ? parts : looseParts),
    accepted: shared ? 'Accepted' : typeOf('accepted', 'Accepted'),
    answer: typeOf('answer', 'Answer'),
    usesClasses,
    hasTypedParams,
    hasBody,
  };
}

function narrowed(parts: readonly string[]): string {
  return parts.length === 0 ? 'HttpRequest' : `HttpRequest<{ ${parts.join('; ')} }>`;
}
