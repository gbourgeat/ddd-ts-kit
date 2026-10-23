import { braceDepthAt } from '../text/brace-depth-at';
import { identifier } from '../text/identifier';
import type { Exported } from './exported';
import type { LocalType } from './local-types';
import { typeClosure } from './type-closure';

const STATE =
  /(?<![\w$.])(?<!export\s+)(?:(?:let|var)\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*new\s)/g;

/**
 * Allowance 4b: at least two exported functions, each one using a module-private state (a `let`,
 * or a `const` holding a `new ..`), all linked through the state they share; what else is counted
 * is of their signatures.
 */
export function sharesState(counted: readonly Exported[], code: string, types: readonly LocalType[]): boolean {
  const functions = counted.filter((candidate) => candidate.kind === 'function');

  const state = [...code.matchAll(STATE)]
    .filter((match) => braceDepthAt(code, match.index) === 0)
    .flatMap((match) => match[1] ?? match[2] ?? []);

  const used = functions.map((accessor) =>
    state.filter((name) => identifier(name).test(accessor.text.slice(accessor.signature.length))),
  );

  if (functions.length < 2 || used.some((names) => names.length === 0) || !isOneGroup(used)) {
    return false;
  }

  const closure = typeClosure(
    functions.map((accessor) => accessor.signature),
    types,
  );

  return counted.every((other) => other.kind === 'function' || (other.kind === 'interface' && closure.has(other.name)));
}

/** True when the functions form one group, two of them being linked when they use a same state. */
function isOneGroup(used: readonly (readonly string[])[]): boolean {
  const reached = new Set<string>(used[0] ?? []);
  let pending = used.slice(1);

  for (;;) {
    const linked = pending.filter((names) => names.some((name) => reached.has(name)));

    if (linked.length === 0) {
      return pending.length === 0;
    }

    for (const name of linked.flat()) {
      reached.add(name);
    }

    pending = pending.filter((names) => !linked.includes(names));
  }
}
