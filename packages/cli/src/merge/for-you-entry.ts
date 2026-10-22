import { runGit } from '../commit/run-git';
import type { ConflictBlock } from './conflict-blocks';
import type { ForYou } from './merge-report';
import type { Resolution } from './resolution';

/** Who the two sides are: the branch with its rows, the trunk since the base. */
export interface SidesNamed {
  readonly top: string;
  readonly branch: string;
  readonly rows: readonly string[];
  readonly trunk: { readonly ref: string; readonly commit: string };
  readonly base: string;
}

const NEVER_ONE_SIDE = 'Never take one side of the whole file.';

/**
 * A path left to a person, told so that it can be settled without reading either history: the
 * lines of each conflict, what this branch and its rows did there, the commits of the trunk that
 * touched the file since the base and what they did, and how to settle it.
 */
export function forYouEntry(resolution: Resolution, sides: SidesNamed): ForYou {
  const { blocks } = resolution;

  const commits = (
    runGit(sides.top, ['log', '--format=%h %s', `${sides.base}..${sides.trunk.commit}`, '--', resolution.file]) ?? ''
  )
    .split('\n')
    .filter((line) => line !== '');

  return {
    file: resolution.file,
    kind: resolution.kind,
    why: resolution.how,
    hunks: blocks.map((block) => `${block.line}-${block.line + block.raw.length - 1}`),
    ours: { branch: sides.branch, rows: sides.rows, change: changeOf(blocks, 'ours') },
    theirs: { ref: sides.trunk.ref, commits, change: changeOf(blocks, 'theirs') },
    advice: adviceOf(resolution),
  };
}

/** What one side did in the conflicts: what it adds and removes, its first added line as an example. */
function changeOf(blocks: readonly ConflictBlock[], side: 'ours' | 'theirs'): string {
  const added = blocks.flatMap((block) =>
    block[side].filter((line) => !block.base.includes(line) && line.trim() !== ''),
  );

  const removed = blocks.flatMap((block) =>
    block.base.filter((line) => !block[side].includes(line) && line.trim() !== ''),
  );

  const first = added[0]?.trim();
  const example = first === undefined ? '' : `: ${first.length > 72 ? `${first.slice(0, 69)}...` : first}`;

  if (added.length === 0 && removed.length === 0) {
    return blocks.length === 0 ? 'see the file' : 'keeps the lines of the base';
  }

  const counts = [
    ...(added.length > 0 ? [`adds ${added.length}`] : []),
    ...(removed.length > 0 ? [`removes ${removed.length}`] : []),
  ];

  return `${counts.join(', ')} line${added.length + removed.length === 1 ? '' : 's'}${example}`;
}

function adviceOf({ blocks, how }: Resolution): string {
  if (blocks.length === 0) {
    return `${how}: decide what the result holds, then \`git add\` or \`git rm\` it. ${NEVER_ONE_SIDE}`;
  }

  const onlyAdding = blocks.every((block) =>
    block.base.every((line) => block.ours.includes(line) && block.theirs.includes(line)),
  );

  return onlyAdding
    ? `both sides only add lines: keep both. ${NEVER_ONE_SIDE}`
    : `both sides change the same lines: write the lines that keep the intent of each. ${NEVER_ONE_SIDE}`;
}
