import type { AspectKind } from './aspect-kind';
import type { Selector } from './selector';

/** Instances bound with `.as(kind)` to one of the kinds. An instance without kind never matches. */
export function forKinds(...kinds: readonly AspectKind[]): Selector {
  return (joinPoint) => joinPoint.kind !== undefined && kinds.includes(joinPoint.kind);
}

/** Methods by name; `*` stands for any run of characters: `find*`, `*ById`, `get*For*`. */
export function forMethods(...patterns: readonly string[]): Selector {
  const expressions = patterns.map(expressionOf);

  return (joinPoint) => expressions.some((expression) => expression.test(joinPoint.method));
}

/** Instances of one of the bounded contexts. */
export function forContext(...contexts: readonly string[]): Selector {
  return (joinPoint) => joinPoint.context !== undefined && contexts.includes(joinPoint.context);
}

/** Instances by class name, with the same `*` as `forMethods`: `Http*`, `*Gateway`. */
export function forClasses(...patterns: readonly string[]): Selector {
  const expressions = patterns.map(expressionOf);

  return (joinPoint) => expressions.some((expression) => expression.test(joinPoint.className));
}

export function allOf(...selectors: readonly Selector[]): Selector {
  return (joinPoint) => selectors.every((selector) => selector(joinPoint));
}

export function anyOf(...selectors: readonly Selector[]): Selector {
  return (joinPoint) => selectors.some((selector) => selector(joinPoint));
}

export function not(selector: Selector): Selector {
  return (joinPoint) => !selector(joinPoint);
}

function expressionOf(pattern: string): RegExp {
  const literal = pattern.split('*').map((part) => part.replaceAll(/[.+?^${}()|[\]\\]/g, String.raw`\$&`));

  return new RegExp(`^${literal.join('.*')}$`);
}
