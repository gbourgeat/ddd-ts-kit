import { changedSince } from './changed-since';
import { mutationSettings } from './mutation-settings';
import { REFUSAL_TEXTS } from './refusal-texts-ignorer';

/** The part of the options of Stryker that the config file of a project governs. */
export interface GovernedMutation {
  /** The domain and application layers of every context, at its level and in the modules of its model, one pattern per layer since Stryker warns at every run about a pattern that matches nothing; the generated declarations left out. */
  readonly mutate: string[];
  /** The module of the ignorer of the kit, loaded beside the plugins Stryker finds by itself. */
  readonly appendPlugins: string[];
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
  /**
   * The reading of a change (`DDD_TS_KIT_MUTATION_SINCE` names its base): the results of the last
   * report, kept in `incrementalFile`, are reused for what the change leaves alone, and the run
   * takes the time of its initial test run. A full run otherwise, the truth of the night.
   */
  readonly incremental: boolean;
  readonly incrementalFile: string;
  /**
   * The whole run even with a report at hand, when the change touches what the tests lean on and
   * Stryker does not diff: a fake, a builder, a world, the platform, a dependency. It diffs the
   * mutated sources and the specs alone, and would reuse a result the change made stale.
   */
  readonly force: boolean;
  /** The lowest floor, which the whole run is held to; `ddd-ts-kit mutation` then holds each layer of each context to its own. */
  readonly thresholds: { readonly high: number; readonly low: number; readonly break: number };
}

/** The clear-text reporter colours a score above `high` as good. */
const HIGH = 80;

/** The module of the ignorer, as the file Stryker loads it from: beside this one, once built. */
const IGNORER_MODULE = new URL('./refusal-texts-ignorer.js', import.meta.url).href;

/** The git ref the job of a pull request reads a change from: the merge base with the branch it targets. */
const SINCE = 'DDD_TS_KIT_MUTATION_SINCE';
/** Beside the json report, kept with it as the artifact of the night. */
const INCREMENTAL_FILE = 'reports/mutation/incremental.json';

/**
 * What a Stryker run mutates and the floor it is held to, read from the `mutation` key of
 * `ddd-ts-kit.config.json` (the reference when the key is absent): the one place the floor is
 * written. The domain and application layers of every context are mutated, the texts of their
 * refusals left out, since a refusal is asserted by its code and never by its text.
 *
 *     // stryker.config.mjs
 *     import { governedMutation } from '@ddd-ts-kit/testing/mutation';
 *     export default { testRunner: 'vitest', ...governedMutation() };
 */
export function governedMutation(root: string = process.cwd()): GovernedMutation {
  const { contextsDir, floors } = mutationSettings(root);
  const since = process.env[SINCE];
  const lowest = Math.min(...Object.values(floors));

  return {
    mutate: [
      `${contextsDir}/**/domain/**/*.ts`,
      `${contextsDir}/**/application/**/*.ts`,
      `!${contextsDir}/**/*.declarations.ts`,
      '!**/*.spec.ts',
    ],
    appendPlugins: [IGNORER_MODULE],
    ignorers: [REFUSAL_TEXTS],
    ignoreStatic: true,
    incremental: since !== undefined,
    incrementalFile: INCREMENTAL_FILE,
    force: since !== undefined && leansOnSupport(root, since),
    thresholds: { high: Math.max(HIGH, ...Object.values(floors)), low: lowest, break: lowest },
  };
}

/** Code or configuration the tests may lean on: a document, an image or a pipeline file changes no test. */
const CODE = /\.(?:[cm]?[jt]sx?|json)$/;

/** Whether the change touches code the incremental run would not diff; a change git cannot list counts as one. */
function leansOnSupport(root: string, since: string): boolean {
  const changed = changedSince(root, since);

  return changed === undefined || changed.some((file) => CODE.test(file) && !diffedByStryker(file));
}

/** A mutated source of the domain, or a spec: what Stryker compares with the last report by itself. */
function diffedByStryker(file: string): boolean {
  return (
    file.endsWith('.spec.ts') ||
    (file.includes('/domain/') && file.endsWith('.ts') && !file.endsWith('.declarations.ts'))
  );
}
