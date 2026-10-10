import type { DependencyKind } from '@ddd-ts-kit/kernel';
import { describeToken, type Token } from '@ddd-ts-kit/kernel/declarations';
import { traceDependency } from './trace-dependency.js';

/**
 * What an application says about the binding an instance comes from: the `decorate` hook of
 * `createApplication` and a binding aspect both fit.
 */
export interface TracedBinding {
  /** Name of the module that declared the binding. */
  readonly context: string;
  /** The role the binding was declared with. A binding without one is not traced. */
  readonly kind?: DependencyKind;
  /** The port the binding is made under, or its description. */
  readonly token?: Token<unknown> | string;
  /** The bound class, when the application knows it. */
  readonly className?: string;
}

/** Each has a span of its own kind already: the use case middleware, `process <consumer>`, `job <name>`. */
const TRACED_ELSEWHERE: ReadonlySet<DependencyKind> = new Set<DependencyKind>(['use-case', 'consumer', 'job']);

/** Named after their class: the token of a handler is the handler. */
const NAMED_BY_CLASS: ReadonlySet<DependencyKind> = new Set<DependencyKind>(['domain-event-handler']);

/**
 * Traces the bindings of an application, as a `decorate` hook or as the `binding` of
 * `traceApplication()`: every instance of a repository, a gateway, an external adapter, a
 * publisher or a domain event handler is wrapped by `traceDependency` under the name of its
 * context and of its port. Use cases, consumers and jobs are left alone, since each already
 * has its span; so is a binding without kind.
 */
export function traceBindings(): <T>(instance: T, binding: TracedBinding) => T {
  return (instance, binding) => {
    const { context, kind, className } = binding;

    if (kind === undefined || TRACED_ELSEWHERE.has(kind) || typeof instance !== 'object' || instance === null) return instance;

    const port = NAMED_BY_CLASS.has(kind) ? undefined : portOf(binding.token);

    return traceDependency(instance, {
      kind,
      context,
      ...(className === undefined ? {} : { className }),
      ...(port === undefined ? {} : { port }),
    });
  };
}

function portOf(token: TracedBinding['token']): string | undefined {
  if (token === undefined) return undefined;

  return typeof token === 'string' ? token : describeToken(token);
}
