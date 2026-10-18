import type { LintAnswer } from './parse-lint-answer.js';

export interface LintVerdict {
  readonly errors: number;
  /** The warnings that fail the lint: every one but those of a rule in transition. */
  readonly warnings: number;
  /** Each rule of the kit in transition, the warnings it reported and the version in which it becomes an error. */
  readonly inTransition: readonly { readonly ruleId: string; readonly until: string; readonly warnings: number }[];
}

const ERROR = 2;

/**
 * An error fails the lint, and so does a warning, unless its rule is one of the kit in transition:
 * a new rule reaches projects as a warning first, and an upgrade of the kit never turns a green
 * lint red. Its warnings are counted apart, to be fixed before the version that makes it an error.
 */
export function lintVerdict({ messages, transitions }: Pick<LintAnswer, 'messages' | 'transitions'>): LintVerdict {
  const inTransition = new Map<string, LintVerdict['inTransition'][number]>();
  let warnings = 0;

  for (const { ruleId } of messages.filter((message) => message.severity !== ERROR)) {
    const until = ruleId === null ? undefined : transitions[ruleId];

    if (ruleId === null || until === undefined) {
      warnings += 1;
    } else {
      inTransition.set(ruleId, { ruleId, until, warnings: (inTransition.get(ruleId)?.warnings ?? 0) + 1 });
    }
  }

  return {
    errors: messages.filter((message) => message.severity === ERROR).length,
    warnings,
    inTransition: [...inTransition.values()].sort((left, right) => left.ruleId.localeCompare(right.ruleId)),
  };
}
