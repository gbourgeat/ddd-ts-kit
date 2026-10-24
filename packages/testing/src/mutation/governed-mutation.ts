import { mutationSettings } from './mutation-settings';

/** The part of the options of Stryker that the config file of a project governs. */
export interface GovernedMutation {
  /** The domain layer of every context, at its level and in the modules of its model, in one pattern since Stryker warns at every run about a pattern that matches nothing; the generated declarations left out. */
  readonly mutate: string[];
  /** The texts of refusals are never asserted by a test of the kit: a mutant of a string literal would survive by design. */
  readonly mutator: { readonly excludedMutations: string[] };
  /**
   * A static mutant, in code that runs once when the module loads (a transition table, a constant, a
   * pattern at the top of a file), reloads the environment and runs every test: it is ignored, and the
   * score says nothing about a rule written as a declaration, which a test states by itself.
   */
  readonly ignoreStatic: boolean;
  /** The floor the whole run is held to; `ddd-ts-kit mutation` then holds each context to it. */
  readonly thresholds: { readonly high: number; readonly low: number; readonly break: number };
}

/** The clear-text reporter colours a score above `high` as good. */
const HIGH = 80;

/**
 * What a Stryker run mutates and the floor it is held to, read from the `mutation` key of
 * `ddd-ts-kit.config.json` (the reference when the key is absent): the one place the floor is
 * written. The domain layer of every context is mutated, its string literals left out, since a
 * refusal is asserted by its code and never by its text.
 *
 *     // stryker.config.mjs
 *     import { governedMutation } from '@ddd-ts-kit/testing/mutation';
 *     export default { testRunner: 'vitest', ...governedMutation() };
 */
export function governedMutation(root: string = process.cwd()): GovernedMutation {
  const { contextsDir, domain } = mutationSettings(root);

  return {
    mutate: [`${contextsDir}/**/domain/**/*.ts`, `!${contextsDir}/**/*.declarations.ts`, '!**/*.spec.ts'],
    mutator: { excludedMutations: ['StringLiteral'] },
    ignoreStatic: true,
    thresholds: { high: Math.max(HIGH, domain), low: domain, break: domain },
  };
}
