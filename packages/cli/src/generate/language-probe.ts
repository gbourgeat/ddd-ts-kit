/** A name a generator checks against the glossary of a context, as it reaches the check. */
export interface HeardName {
  readonly context: string;
  /** Directory of the context, relative to the project root: its CONTEXT.md holds the glossary. */
  readonly dir: string;
  readonly name: string;
  /** The words a name of this role may carry besides the glossary: the qualifiers of a refusal. */
  readonly qualifiers: readonly string[];
}

/**
 * Hears each name a generator would judge against the glossary, in place of the judgement: the
 * generator then writes on whatever the words. `plan-waves` replays the planned commands with one,
 * so that the generator itself says which names a command introduces.
 */
export type LanguageProbe = (heard: HeardName) => void;
