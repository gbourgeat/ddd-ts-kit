import { readConfig } from '../config';
import { Workspace } from '../workspace';
import { acceptInMergeMessage } from './accept-in-merge-message';
import { lineKey } from './lost/line-key';
import { trailerInMergeMessage } from './trailer-in-merge-message';
import { asSettled } from './as-settled';
import { gitProcess } from './git-process';
import { normalizedLines } from './lost/normalized-lines';
import type { MergeContext } from './merge-context';
import type { Settled } from './merge-report';
import { tableNamesSettled } from './table-names-settled';
import { trunkReader } from './trunk-reader';

/** The commits a merge joins: the trunk, and the branch as it was before the merge. */
interface MergedCommits {
  readonly trunk: string;
  readonly ours: string;
}

/**
 * Two branches that each stored a table of one name, each in its context, merge into a schema index
 * that holds the lines of both and compiles on neither Drizzle nor TypeORM: each side wrote its
 * line as the first to hold the name. The index is settled the way the generators settle it: a
 * name the trunk exports keeps naming the table it names there, as the code of the trunk and of
 * every other branch reads it, and the table the branch brings takes the name of its context. The
 * index is staged again, and the report says what was done. The configuration is read again: the
 * merge may have brought contexts. An error here leaves the index as the merge wrote it: the
 * caller says it in the report, and the merge goes on. An entity both sides imported, each under
 * its name, keeps one: the import of the branch that goes is a line the merge does not keep on
 * purpose, recorded in its message as the lost-lines check reads it.
 */
export function settleTableNames({ root, repo }: MergeContext, { trunk, ours }: MergedCommits): Settled[] {
  const { config } = readConfig(root);
  const ws = new Workspace(root, false);
  const index = `${config.platformDir}/database/schema.ts`;
  const sides = { onTrunk: trunkReader(repo, trunk), onBranch: trunkReader(repo, ours) };
  const before = ws.read(index) ?? '';
  const said = tableNamesSettled(ws, config, sides);

  if (said.length > 0) {
    ws.commit(false);
    gitProcess(repo.top, ['--literal-pathspecs', 'add', '--', `${repo.prefix}${index}`]);

    recorded(repo, {
      file: `${repo.prefix}${index}`,
      before,
      after: ws.read(index) ?? '',
      sides: { trunk: sides.onTrunk(index) ?? '', branch: sides.onBranch(index) ?? '' },
    });
  }

  return asSettled(said, { file: `${repo.prefix}${index}`, index });
}

/** The index before and after the settle, and as each side holds it. */
interface Written {
  readonly file: string;
  readonly before: string;
  readonly after: string;
  readonly sides: { readonly trunk: string; readonly branch: string };
}

/**
 * Tells the lost-lines check of the merge what the settle did, in trailers of its message: each
 * line it wrote (`Kit-Written:`), which never counts as a line of the merge's own, and each line
 * it took out, accepted by its file, its side and its text (`Lost-Accepted:`), never by its place
 * alone.
 */
function recorded(repo: MergeContext['repo'], { file, before, after, sides }: Written): void {
  const textsOf = (text: string): string[] => normalizedLines(text).map((line) => line.text);
  const was = textsOf(before);
  const is = textsOf(after);
  const ofBranch = new Set(textsOf(sides.branch));
  const ofTrunk = new Set(textsOf(sides.trunk));

  const sideOf = (text: string): string =>
    ofBranch.has(text) && ofTrunk.has(text) ? 'both' : ofTrunk.has(text) ? 'theirs' : 'ours';

  trailerInMergeMessage(repo.top, {
    key: 'Kit-Written',
    entries: is.filter((text) => !was.includes(text)).map((text) => lineKey(file, text)),
  });

  acceptInMergeMessage(
    repo.top,
    was.filter((text) => !is.includes(text)).map((text) => lineKey(file, text, sideOf(text))),
  );
}
