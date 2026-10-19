import type { ExampleCopy } from './example-copy.js';
import type { Finding } from './finding.js';
import type { Injection } from './injection.js';
import { PATHS } from './paths.js';

/**
 * What ESLint says of each injection, by rule id. One ESLint run costs seconds whatever the number
 * of files, so the injections are written together, round after round: a round holds injections
 * that write different files, and a finding belongs to the injection that wrote its file. An
 * injection that writes no source file (the config, a document, a removal) gives ESLint nothing to read.
 * One that changes the config and writes a source is linted alone: the config steers the rules of every file.
 */
export function lintInRounds(copy: ExampleCopy, injections: readonly Injection[]): Map<string, Finding[]> {
  const said = new Map<string, Finding[]>(injections.map((injection) => [injection.rule, []]));
  let waiting = injections.filter((injection) => sourcesOf(injection).length > 0);

  while (waiting.length > 0) {
    const round = disjoint(waiting);

    waiting = waiting.filter((injection) => !round.includes(injection));

    for (const injection of round) {
      copy.apply(injection);
    }

    const findings = copy.linted(round.flatMap(sourcesOf));

    copy.restore();

    for (const injection of round) {
      said.set(
        injection.rule,
        findings.filter((finding) => sourcesOf(injection).includes(finding.file)),
      );
    }
  }

  return said;
}

/** The first injections of the list that share no file, kept in order; one that changes the config comes alone. */
function disjoint(injections: readonly Injection[]): Injection[] {
  const [first] = injections;

  if (first !== undefined && changesConfig(first)) {
    return [first];
  }

  const taken = new Set<string>();

  return injections.filter((injection) => {
    const files = injection.changes.map((change) => change.file);

    if (changesConfig(injection) || files.some((file) => taken.has(file))) {
      return false;
    }

    for (const file of files) {
      taken.add(file);
    }

    return true;
  });
}

function changesConfig({ changes }: Injection): boolean {
  return changes.some((change) => change.file === PATHS.CONFIG);
}

const SOURCE = /\.(?:ts|mts|cts|js|mjs|cjs)$/;

function sourcesOf({ changes }: Injection): string[] {
  return [...new Set(changes.map((change) => change.file))].filter((file) => SOURCE.test(file));
}
