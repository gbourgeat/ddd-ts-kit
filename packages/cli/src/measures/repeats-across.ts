/** The signatures carried by two stories or more, and for each story the ones it shares. */
export function repeatsAcross(signatures: ReadonlyMap<string, readonly string[]>): {
  readonly all: string[];
  readonly byStory: Map<string, string[]>;
} {
  const holders = new Map<string, Set<string>>();

  for (const [story, own] of signatures) {
    for (const signature of own) {
      holders.set(signature, (holders.get(signature) ?? new Set()).add(story));
    }
  }

  const all = [...holders].filter(([, stories]) => stories.size > 1).map(([signature]) => signature);

  return {
    all,
    byStory: new Map(
      [...signatures].map(([story, own]) => [story, own.filter((signature) => all.includes(signature))]),
    ),
  };
}
