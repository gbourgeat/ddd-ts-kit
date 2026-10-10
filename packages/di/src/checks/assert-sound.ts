import {
  CommandBus,
  DomainEventDispatcher,
  EventSubscribers,
  IntegrationEventSubscriber,
  JobScheduler,
  QueryBus,
} from '@ddd-ts-kit/kernel';
import { describeToken, type Token } from '@ddd-ts-kit/kernel/declarations';
import { WiringError } from '../errors/wiring-error.js';
import { sameToken } from '../token/same-token.js';
import { TokenSet } from '../token/token-set.js';
import { whereOf } from '../wiring/where-of.js';
import type { Wiring } from '../wiring/wiring.js';
import { cycleError } from './cycle-error.js';

/** Everything that can be known wrong before a single instance is created. */
export function assertSound(wiring: Wiring, overridden: TokenSet): void {
  assertDependenciesBound(wiring, overridden);
  assertBusesBound(wiring, overridden);
  assertNoCycle(wiring, overridden);
}

function assertDependenciesBound({ bindings }: Wiring, overridden: TokenSet): void {
  for (const binding of bindings.values()) {
    for (const dependency of binding.dependencies) {
      if (bindings.has(dependency) || overridden.has(dependency)) continue;

      throw new WiringError(
        'UNBOUND_DEPENDENCY',
        `"${describeToken(binding.token)}" in ${whereOf(binding)} depends on "${describeToken(dependency)}", which no module binds.`,
      );
    }
  }
}

function assertBusesBound(wiring: Wiring, overridden: TokenSet): void {
  for (const { ports, user, module } of needsOf(wiring)) {
    if (ports.some((port) => wiring.bindings.has(port) || overridden.has(port))) continue;

    throw new WiringError(
      'UNBOUND_DEPENDENCY',
      `Module "${module}" declares ${user}, but no module binds ${ports.map((port) => `"${describeToken(port)}"`).join(' or ')}. Add kernelModule() to the modules.`,
    );
  }
}

interface Need {
  /** Any one of them bound is enough. */
  readonly ports: readonly Token<unknown>[];
  readonly user: string;
  readonly module: string;
}

function needsOf(wiring: Wiring): Need[] {
  return [
    ...wiring.handlings.map(({ kind, message, module }) => ({
      ports: [kind === 'command' ? CommandBus : QueryBus],
      user: `the ${kind} "${message.name}"`,
      module,
    })),
    ...wiring.consumptions.map(({ consumer, module }) => ({
      ports: [IntegrationEventSubscriber, EventSubscribers],
      user: `the consumer "${consumer}"`,
      module,
    })),
    ...wiring.domainEventHandlers.map(({ name, module }) => ({
      ports: [DomainEventDispatcher],
      user: `a handler of the domain event "${name}"`,
      module,
    })),
    ...wiring.jobs.map(({ name, module }) => ({ ports: [JobScheduler], user: `the job "${name}"`, module })),
  ];
}

function assertNoCycle({ bindings }: Wiring, overridden: TokenSet): void {
  const done = new TokenSet();
  const path: Token<unknown>[] = [];

  const visit = (target: Token<unknown>): void => {
    if (done.has(target) || overridden.has(target)) return;

    const loopStart = path.findIndex((step) => sameToken(step, target));

    if (loopStart !== -1) throw cycleError([...path.slice(loopStart), target]);

    path.push(target);

    for (const dependency of bindings.get(target)?.dependencies ?? []) visit(dependency);

    path.pop();
    done.add(target);
  };

  for (const target of bindings.keys()) visit(target);
}
