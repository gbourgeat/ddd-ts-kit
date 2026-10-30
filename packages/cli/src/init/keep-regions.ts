import { regionsOf, type Region } from '../markers';

/** A region of the file as it was that the template of this version no longer holds, and what it held. */
export interface OrphanedRegion {
  readonly region: string;
  readonly lines: readonly string[];
}

/** The file as the template writes it, with what the regions of the file before held, and what no region could take. */
export interface KeptRegions {
  readonly text: string;
  /** The lines of the file before that the text now holds, which the imports they name go with. */
  readonly kept: readonly string[];
  readonly orphaned: readonly OrphanedRegion[];
}

/**
 * A region the template leaves empty belongs to the generators and to the team, the value a
 * gateway was given included: what it holds in the file stays, wherever the template now puts the
 * region and whatever the template now says around it. A region the template fills (`run-jobs`, by
 * the config) is rendered again. Two regions of one name are matched in their order.
 */
export function keepRegions(written: string, existing: string): KeptRegions {
  const before = existing.split('\n');
  const after = written.split('\n');
  const regions = regionsOf(before);
  const held = regions.filter((region) => bodyOf(before, region).some(isText));
  const places = regionsOf(after);
  const paired = held.map((region) => ({ region, place: placeOf(region, { regions, places }) }));
  const taken = paired.filter(({ place }) => place !== undefined && !bodyOf(after, place).some(isText));

  for (const { region, place } of taken.toReversed()) {
    if (place !== undefined) {
      after.splice(place.open + 1, place.close - place.open - 1, ...bodyOf(before, region));
    }
  }

  return {
    text: after.join('\n'),
    kept: taken.flatMap(({ region }) => bodyOf(before, region)),
    orphaned: paired
      .filter(({ place }) => place === undefined)
      .map(({ region }) => ({ region: region.name, lines: bodyOf(before, region).filter(isText) })),
  };
}

function bodyOf(lines: readonly string[], { open, close }: Region): string[] {
  return lines.slice(open + 1, close);
}

function isText(line: string): boolean {
  return line.trim() !== '';
}

/** The region of the template that matches one of the file: the same name, the same rank among those of that name. */
function placeOf(
  region: Region,
  { regions, places }: { readonly regions: readonly Region[]; readonly places: readonly Region[] },
): Region | undefined {
  const named = (candidate: Region): boolean => candidate.name === region.name;

  return places.filter(named)[regions.filter(named).indexOf(region)];
}
