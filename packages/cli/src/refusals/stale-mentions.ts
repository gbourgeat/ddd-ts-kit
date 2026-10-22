import { escapeRegExp } from '../check/text/escape-reg-exp';
import type { Workspace } from '../workspace';
import type { AppliedMoves } from './applied-moves';
import { markdownFiles } from './markdown-files';
import type { MigrationDraft } from './migration-draft';

/** A region `ddd-ts-kit docs` writes again: what it says follows the code by itself. */
const REGION = /^\s*<!--\s*(\/?)ddd-ts-kit:[\w-]+\s*-->\s*$/;

interface Mention {
  readonly name: RegExp;
  readonly note: string;
}

/**
 * Tells, with its line, each place of a Markdown file of the project that still names what the
 * moves replaced: a factory or a class per error that moved, a concept class that is gone. A
 * document is prose: what to write there is a decision. Generated regions are left to `docs`.
 */
export function staleMentions(ws: Workspace, applied: AppliedMoves, draft: MigrationDraft): void {
  const mentions = mentionsOf(applied);

  if (mentions.length === 0) {
    return;
  }

  for (const file of markdownFiles(ws)) {
    let generated = 0;

    for (const [index, line] of (draft.read(file) ?? '').split('\n').entries()) {
      const region = REGION.exec(line);

      generated += region === null ? 0 : region[1] === '/' ? -1 : 1;

      const mention = generated > 0 ? undefined : mentions.find(({ name }) => name.test(line));

      if (mention !== undefined) {
        draft.manual.push(`${file}:${index + 1}: ${mention.note}`);
      }
    }
  }
}

/** What each move replaced, the factory before its class (`AppointmentError.ended` says more than `AppointmentError`). */
function mentionsOf({ moves, gone }: AppliedMoves): Mention[] {
  const named = (text: string): RegExp => new RegExp(`(?<![\\w$.])${escapeRegExp(text)}(?![\\w$])`);

  return [
    ...moves.map((move) => ({
      name: named(move.from),
      note: `${move.from} is now ${move.className}.${move.factory}: rewrite the sentence.`,
    })),
    ...[...gone].map((concept) => ({
      name: named(concept),
      note: `${concept} is gone: name the refusal classes that replace it.`,
    })),
  ];
}
