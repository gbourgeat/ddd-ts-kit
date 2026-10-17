import { runGit } from '../commit/run-git.js';
import { escapeRegExp } from '../check/text/escape-reg-exp.js';
import type { Evidence } from './evidence.js';
import type { History, Removal } from './history.js';
import { namesOfFile } from './names-of-file.js';

const BY_NAME = new WeakMap<History, ReadonlyMap<string, readonly Removal[]>>();

/**
 * The most recent removal of a file whose name gives `name` (`verify-occupancy.command.ts` gives
 * `VerifyOccupancy`), when the file declared, before its removal, a name of its stem: a file
 * name alone is no evidence that the name existed.
 */
export function removalNaming(name: string, evidence: Evidence): Removal | undefined {
  const removals = byName(evidence.history).get(name) ?? [];

  return removals.find((removal) => declaredItsStem(evidence.root, removal));
}

function byName(history: History): ReadonlyMap<string, readonly Removal[]> {
  const known = BY_NAME.get(history);

  if (known !== undefined) {
    return known;
  }

  const removals = new Map<string, Removal[]>();

  for (const removal of history.removals.values()) {
    namesOfFile(removal.path).forEach((name) => removals.set(name, [...(removals.get(name) ?? []), removal]));
  }

  BY_NAME.set(history, removals);

  return removals;
}

function declaredItsStem(root: string, removal: Removal): boolean {
  const [stem = ''] = namesOfFile(removal.path);
  const text = runGit(root, ['show', `${removal.before}:./${removal.path}`]) ?? '';
  const declaration = new RegExp(`(?<![\\w$])(?:class|interface|type|enum|function|const)\\s+${escapeRegExp(stem)}`);

  return declaration.test(text);
}
