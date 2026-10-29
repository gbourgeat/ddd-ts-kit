import { findKind } from './find-kind';
import { GENERATE_OPTIONS } from './generate-options';
import type { Kind } from './kind';
import { KINDS } from './kinds';

/**
 * The kind a command line asks for: its first word that is neither a flag nor the value of one
 * (`generate --module pricing job catalog Reprice` asks for a job). A flag that is a text for some
 * kinds only (`--command <UseCase>` of a job) takes the next word unless that word is a kind.
 */
export function kindIn(argv: readonly string[]): Kind | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const word = argv[index] ?? '';

    if (!word.startsWith('-')) {
      return findKind(word);
    }

    const next = argv[index + 1] ?? '';

    if (!word.includes('=') && takesValue(word.replace(/^-+/, ''), next)) {
      index += 1;
    }
  }

  return undefined;
}

function takesValue(flag: string, next: string): boolean {
  const option = Object.entries(GENERATE_OPTIONS).find(([name]) => name === flag)?.[1];

  if (flag === 'cwd' || option?.type === 'string') {
    return true;
  }

  return KINDS.some((kind) => kind.textFlags?.includes(flag) === true) && findKind(next) === undefined;
}
