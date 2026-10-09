import { WiringError } from './errors.js';
import { COMMAND_BUS, EVENT_SUBSCRIBER, QUERY_BUS } from './kernel-tokens.js';
import type { Wiring } from './module.js';
import { describeToken, type Token } from './token.js';

type Tokens = ReadonlySet<Token<unknown>>;

/** Everything that can be known wrong before a single instance is created. */
export function assertSound(wiring: Wiring, overridden: Tokens): void {
  assertDependenciesBound(wiring, overridden);
  assertBusesBound(wiring, overridden);
  assertNoCycle(wiring, overridden);
}

function assertDependenciesBound({ bindings }: Wiring, overridden: Tokens): void {
  for (const binding of bindings.values()) {
    for (const dependency of binding.dependencies) {
      if (bindings.has(dependency) || overridden.has(dependency)) continue;
      throw new WiringError(
        'UNBOUND_DEPENDENCY',
        `"${describeToken(binding.token)}" in module "${binding.module}" depends on "${describeToken(dependency)}", which no module binds.`,
      );
    }
  }
}

function assertBusesBound(wiring: Wiring, overridden: Tokens): void {
  const needs = [
    ...wiring.handlings.map(({ kind, message, module }) => ({
      bus: kind === 'command' ? COMMAND_BUS : QUERY_BUS,
      user: `the ${kind} "${message.name}"`,
      module,
    })),
    ...wiring.consumptions.map(({ consumer, module }) => ({
      bus: EVENT_SUBSCRIBER,
      user: `the consumer "${consumer}"`,
      module,
    })),
  ];
  for (const { bus, user, module } of needs) {
    if (wiring.bindings.has(bus) || overridden.has(bus)) continue;
    throw new WiringError(
      'UNBOUND_DEPENDENCY',
      `Module "${module}" declares ${user}, but no module binds "${describeToken(bus)}". Add kernelModule() to the modules.`,
    );
  }
}

function assertNoCycle({ bindings }: Wiring, overridden: Tokens): void {
  const done = new Set<Token<unknown>>();
  const path: Token<unknown>[] = [];

  const visit = (target: Token<unknown>): void => {
    if (done.has(target) || overridden.has(target)) return;
    const loopStart = path.indexOf(target);
    if (loopStart !== -1) throw cycleError([...path.slice(loopStart), target]);
    path.push(target);
    for (const dependency of bindings.get(target)?.dependencies ?? []) visit(dependency);
    path.pop();
    done.add(target);
  };
  for (const target of bindings.keys()) visit(target);
}

export function cycleError(path: readonly Token<unknown>[]): WiringError {
  return new WiringError(
    'DEPENDENCY_CYCLE',
    `Dependency cycle: ${path.map((step) => `"${describeToken(step)}"`).join(' -> ')}.`,
  );
}
