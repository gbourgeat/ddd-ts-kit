import { mutationSettings } from './mutation-settings';
import { REFUSAL_TEXTS } from './refusal-texts-ignorer';

/** The part of the options of Stryker that the config file of a project governs. */
export interface GovernedMutation {
  /** The domain layer of every context, at its level and in the modules of its model, in one pattern since Stryker warns at every run about a pattern that matches nothing; the generated declarations left out. */
  readonly mutate: string[];
  /** The modules Stryker loads: its own plugins, and the ignorer of the kit. */
  readonly plugins: string[];
  /**
   * The texts of refusals are never asserted by a test of the kit, which asserts a refusal by its
   * code: a mutant of such a text would survive by design, so the ignorer of the kit leaves them
   * out, the message of `refusal(..)`, of `super(..)` in an error class and of `new ..Error(..)`,
   * and every other string of the domain stays measured.
   */
  readonly ignorers: string[];
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

/** The module of the ignorer, as the file Stryker loads it from: beside this one, once built. */
const IGNORER_MODULE = new URL('./refusal-texts-ignorer.js', import.meta.url).href;

/**
 * What a Stryker run mutates and the floor it is held to, read from the `mutation` key of
 * `ddd-ts-kit.config.json` (the reference when the key is absent): the one place the floor is
 * written. The domain layer of every context is mutated, the texts of its refusals left out, since a
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
    plugins: ['@stryker-mutator/*', IGNORER_MODULE],
    ignorers: [REFUSAL_TEXTS],
    ignoreStatic: true,
    thresholds: { high: Math.max(HIGH, domain), low: domain, break: domain },
  };
}
