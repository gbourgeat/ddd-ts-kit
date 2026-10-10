import type { Exported } from './exported.js';
import type { LocalType } from './local-types.js';
import { typeClosure } from './type-closure.js';

/**
 * The exports M such that every other counted export is an interface of M's signature (allowance
 * 1), a function derived from M taken with it (`retryAdvice` called by `retry`), or shares M's name.
 */
export function explainedMains(
  exported: readonly Exported[],
  counted: readonly Exported[],
  types: readonly LocalType[],
): Exported[] {
  const firstOfName = exported.filter(
    (candidate, index) => exported.findIndex((other) => other.name === candidate.name) === index,
  );

  return firstOfName.filter((main) => {
    const own = exported.filter((candidate) => candidate.name === main.name);
    const implemented = counted.find((candidate) => candidate.name === main.name) ?? main;

    const derived =
      main.kind === 'function' ? counted.filter((candidate) => isDerivedFrom(candidate, implemented)) : [];

    const closure = typeClosure(
      [...own, ...derived].map((candidate) => candidate.signature),
      types,
    );

    return counted.every(
      (other) =>
        other.name === main.name || derived.includes(other) || (other.kind === 'interface' && closure.has(other.name)),
    );
  });
}

/** `retryAdvice` for `retry`: the name of the main followed by an upper-case letter, and called in its body. */
function isDerivedFrom(candidate: Exported, main: Exported): boolean {
  if (
    candidate.kind !== 'function' ||
    !candidate.name.startsWith(main.name) ||
    !/^[A-Z]/.test(candidate.name.slice(main.name.length))
  ) {
    return false;
  }

  return new RegExp(`(?<![\\w$.])${candidate.name.replace(/\$/g, '\\$')}\\s*\\(`).test(
    main.text.slice(main.signature.length),
  );
}
