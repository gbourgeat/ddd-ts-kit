import type { MessageInfo } from '@ddd-ts-kit/kernel';
import type { Binding, BindingSource, DependencyKind, Lifetime, Wiring } from './module.js';
import { describeToken, type Token } from './token.js';

export interface BindingDescription {
  readonly token: string;
  readonly module: string;
  readonly kind?: DependencyKind;
  readonly lifetime: Lifetime;
  readonly source: BindingSource;
  /** Class name, for a `class` source. */
  readonly implementation?: string;
  /** Declared by classes only: a factory resolves what it wants at run time. */
  readonly dependencies: readonly string[];
  /** True when an override stands in for this binding. */
  readonly overridden: boolean;
}

export interface HandlerDescription {
  readonly message: string;
  readonly handler: string;
  readonly module: string;
  /** Absent when the module declared no access for the use case. */
  readonly access?: 'public' | 'protected';
  /** The id of the required permission, for a protected use case. */
  readonly permission?: string;
}

export interface SubscriptionDescription {
  readonly event: string;
  readonly version: number;
  readonly consumer: string;
  readonly handler: string;
  readonly module: string;
}

/** The wiring as plain, serializable data: tokens and classes appear by name. */
export interface WiringDescription {
  readonly modules: readonly string[];
  readonly bindings: readonly BindingDescription[];
  readonly commands: readonly HandlerDescription[];
  readonly queries: readonly HandlerDescription[];
  readonly subscriptions: readonly SubscriptionDescription[];
  /** Every overridden token, including those no module binds. */
  readonly overrides: readonly string[];
}

export function describeWiring(
  wiring: Wiring,
  overridden: ReadonlySet<Token<unknown>>,
): WiringDescription {
  return {
    modules: wiring.modules,
    bindings: [...wiring.bindings.values()].map((binding) => describeBinding(binding, overridden)),
    commands: describeHandlers(wiring, 'command'),
    queries: describeHandlers(wiring, 'query'),
    subscriptions: wiring.consumptions.map(({ type, version, consumer, handler, module }) => ({
      event: type,
      version,
      consumer,
      handler: describeToken(handler),
      module,
    })),
    overrides: [...overridden].map(describeToken),
  };
}

function describeBinding(
  binding: Binding,
  overridden: ReadonlySet<Token<unknown>>,
): BindingDescription {
  return {
    token: describeToken(binding.token),
    module: binding.module,
    ...(binding.kind === undefined ? {} : { kind: binding.kind }),
    lifetime: binding.lifetime,
    source: binding.source,
    ...(binding.implementation === undefined ? {} : { implementation: binding.implementation }),
    dependencies: binding.dependencies.map(describeToken),
    overridden: overridden.has(binding.token),
  };
}

function describeHandlers(wiring: Wiring, kind: MessageInfo['kind']): HandlerDescription[] {
  return wiring.handlings
    .filter((handling) => handling.kind === kind)
    .map(({ message, handler, module, requirement }) => ({
      message: message.name,
      handler: describeToken(handler),
      module,
      ...(requirement.access === undefined ? {} : { access: requirement.access }),
      ...(requirement.permission === undefined ? {} : { permission: requirement.permission.id }),
    }));
}
