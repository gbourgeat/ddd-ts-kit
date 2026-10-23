import { type ConflictClass, classifyConflict } from './classify-conflict';
import { mergeClientManifest } from './merge-client-manifest';
import { type ConflictBlock, conflictBlocks, type Segment } from './conflict-blocks';
import type { ConflictedPath } from './conflicted-path';
import type { MergeRepository } from './lost/merge-repository';
import { mergeSlicesRows } from './merge-slices-rows';
import { mergeStoredEventsLock } from './merge-stored-events-lock';
import { registryUnion } from './registry-union';
import type { Resolution } from './resolution';
import { settleRegions } from './settle-regions';

const DERIVED = 'derived: trunk side, regenerated at the end';

/** The classes whose trunk side is taken whole: a tool writes them again after the merge. */
const TRUNK_SIDE: Readonly<Partial<Record<ConflictClass, string>>> = {
  derived: DERIVED,
  'drizzle-meta': 'drizzle-kit journal and snapshots: trunk side, the migrations of the branch generated again on top',
  lockfile: 'lockfile: trunk side',
};

/**
 * Settles a conflicted path by its class: the trunk's side of what a tool writes again, the
 * package.json of a client at the higher version of both sides, the slices rows and the
 * stored-events lock merged by their keys, and inside a source or a mixed document
 * each conflict lying in a generated region. What is left is a person's: a source conflict, a
 * cell or a key both sides changed, a file one side deleted, bytes that are not text.
 */
export function resolveConflict(path: ConflictedPath, repo: MergeRepository): Resolution {
  const kind = classifyConflict(path.file, repo);

  if (kind === 'client-manifest') {
    return clientManifest(path);
  }

  const trunkSide = TRUNK_SIDE[kind];

  if (trunkSide !== undefined) {
    return { file: path.file, kind, content: path.theirs ?? null, settled: true, how: trunkSide, blocks: [] };
  }

  const { ours, theirs } = path;

  if (path.binary || ours === undefined || theirs === undefined) {
    return leftOver(path, kind, oneSideMissing(path));
  }

  if (kind === 'slices' || kind === 'stored-events') {
    return byKeys({ ...path, ours, theirs }, kind);
  }

  return inRegions(path, kind);
}

/** The trunk's package.json of a client at the higher version of both sides; the trunk's side when one has no text. */
function clientManifest(path: ConflictedPath): Resolution {
  const { file, ours, theirs } = path;
  const kind = 'client-manifest';

  if (path.binary || ours === undefined || theirs === undefined) {
    return { file, kind, content: theirs ?? null, settled: true, how: DERIVED, blocks: [] };
  }

  const merged = mergeClientManifest(ours, theirs);

  return merged.content === undefined
    ? leftOver(path, 'source', merged.why)
    : { file, kind, content: merged.content, settled: true, how: merged.how, blocks: [] };
}

function byKeys(path: ConflictedPath & { ours: string; theirs: string }, kind: 'slices' | 'stored-events'): Resolution {
  const merged =
    kind === 'slices'
      ? mergeSlicesRows(path.base ?? '', path.ours, path.theirs)
      : mergeStoredEventsLock(path.ours, path.theirs);

  if ('text' in merged) {
    const how =
      kind === 'slices'
        ? 'slices rows: merged row by row, each status the furthest of both sides'
        : 'stored-events lock: the versions of both sides';

    return { file: path.file, kind, content: merged.text, settled: true, how, blocks: [] };
  }

  return leftOver(path, kind, `both sides changed ${merged.conflicts.join(', ')} differently`);
}

/** A source or a mixed document: the conflicts inside generated regions settled, the others left. */
function inRegions(path: ConflictedPath, kind: ConflictClass): Resolution {
  const segments = conflictBlocks(path.merged ?? '');
  const before = blocksOf(segments).length;
  const choose = kind === 'mixed' ? (block: ConflictBlock) => block.theirs : registryUnion;
  const settled = settleRegions(segments, choose);
  const content = settled.flatMap((segment) => (segment.kind === 'settled' ? segment.lines : segment.raw)).join('\n');
  const left = blocksOf(conflictBlocks(content));

  if (before > 0 && left.length === 0) {
    const how =
      kind === 'mixed'
        ? 'generated regions: trunk side, regenerated at the end'
        : 'generated registry: the lines of both sides kept';

    return { file: path.file, kind: kind === 'mixed' ? kind : 'registry', content, settled: true, how, blocks: [] };
  }

  return {
    ...leftOver(path, kind, 'a conflict outside any generated region'),
    content: left.length < before ? content : undefined,
    blocks: left,
  };
}

/** Why a path without text on both sides is left to a person. */
function oneSideMissing(path: ConflictedPath): string {
  if (path.binary) {
    return 'a side is not text';
  }

  return `${path.ours === undefined ? 'this branch' : 'the trunk'} deleted it, the other side changed it`;
}

function leftOver(path: ConflictedPath, kind: ConflictClass, why: string): Resolution {
  return {
    file: path.file,
    kind,
    content: undefined,
    settled: false,
    how: why,
    blocks: blocksOf(conflictBlocks(path.merged ?? '')),
  };
}

function blocksOf(segments: readonly Segment[]): ConflictBlock[] {
  return segments.filter((segment) => segment.kind === 'conflict');
}
