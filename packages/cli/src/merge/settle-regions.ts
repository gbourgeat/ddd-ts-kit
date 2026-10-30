import { REGION_MARKER } from '../markers';
import type { ConflictBlock, Segment } from './conflict-blocks';

/** What settles a conflict inside a region: its lines, or undefined to leave it to a person. */
export type RegionChoice = (block: ConflictBlock, region: string) => readonly string[] | undefined;

/**
 * Settles each conflict that lies inside one generated region, opened before it and closed after
 * it by settled lines, with what `choose` answers. A conflict that holds a marker itself, or lies
 * outside any region, is left as it is.
 */
export function settleRegions(segments: readonly Segment[], choose: RegionChoice): Segment[] {
  const regions = regionsOf(segments);

  return segments.map((segment, index) => {
    const region = regions.get(index);
    const lines = segment.kind === 'conflict' && region !== undefined ? choose(segment, region) : undefined;

    return lines === undefined ? segment : { kind: 'settled', lines };
  });
}

/** The region each conflict lies in, by its index, when the region is closed after it. */
function regionsOf(segments: readonly Segment[]): Map<number, string> {
  const open: { name: string; blocks: number[] }[] = [];
  const regions = new Map<number, string>();

  segments.forEach((segment, index) => {
    if (segment.kind === 'conflict') {
      if (![...segment.ours, ...segment.base, ...segment.theirs].some((line) => REGION_MARKER.test(line))) {
        open.at(-1)?.blocks.push(index);
      }
    } else {
      segment.lines.forEach((line) => {
        followed(open, line, regions);
      });
    }
  });

  return regions;
}

/** Opens a region on its opening marker; on its closing one, gives its name to the conflicts it held. */
function followed(open: { name: string; blocks: number[] }[], line: string, regions: Map<number, string>): void {
  const [, closing, name] = REGION_MARKER.exec(line) ?? [];

  if (name !== undefined && closing === '') {
    open.push({ name, blocks: [] });
  } else if (name !== undefined && open.at(-1)?.name === name) {
    open.pop()?.blocks.forEach((block) => regions.set(block, name));
  }
}
