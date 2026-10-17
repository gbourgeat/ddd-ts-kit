import path from 'node:path';
import { splitWords } from '../naming/split-words.js';
import { toName } from '../naming/to-name.js';
import type { Evidence } from './evidence.js';
import { roleSuffixOf } from './role-suffix-of.js';
import type { Candidate } from './stale-citation.js';
import { isTestFile } from './is-test-file.js';

const MOST = 3;

/**
 * The names of the code with the stem of a cited name in one of `contexts`: the cited name must
 * end with a role suffix (`RefundBasisService`, stem `RefundBasis`), and the other is the stem and
 * one or two more words (`RefundBasisReader`) whose role plays the same part (a port for a service,
 * a projection for an event handler). An aggregate, an entity, a value, an event or an error,
 * and the test code, are never offered. One name per file, the declared one first; at most three.
 */
export function sameStemNames(cited: string, contexts: readonly string[], evidence: Evidence): Candidate[] {
  const role = roleSuffixOf(cited);

  if (role === undefined) {
    return [];
  }

  const stem = cited.slice(0, -role.suffix.length);
  const places = contexts.map((context) => `${evidence.config.contextsDir}/${context}/`);

  return [...evidence.index.names]
    .flatMap(([name, files]): Candidate[] => {
      const rest = name.slice(stem.length);
      const close = name.startsWith(stem) && name !== cited && /^[A-Z]/.test(rest) && splitWords(rest).length <= 2;

      const file = close
        ? files.find((found) => places.some((place) => found.startsWith(place)) && !isTestFile(found))
        : undefined;

      return file !== undefined && partOf(file, name) === role.part ? [{ name, file, evidence: 'same-stem' }] : [];
    })
    .filter((candidate, position, all) => all.findIndex((other) => other.file === candidate.file) === position)
    .slice(0, MOST);
}

/** The part a name plays: by the role suffix of its file when it has one, by its own suffix otherwise. */
function partOf(file: string, name: string): string | undefined {
  const [, suffix, extension] = path.posix.basename(file).split('.');

  if (suffix !== undefined && extension !== undefined) {
    return roleSuffixOf(`Named${toName(suffix).pascal}`)?.part;
  }

  return roleSuffixOf(name)?.part;
}
