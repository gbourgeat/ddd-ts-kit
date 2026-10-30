import { regionsOf, REGION_MARKER, unpairedMarkers, type Region } from '../markers';

/** What the file before held and the text could not take: the region, its lines when they are known, and why. */
export interface OrphanedRegion {
  readonly region: string;
  readonly lines: readonly string[];
  readonly why: string;
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

  const text = after.join('\n');
  const orphans = paired.filter(({ place }) => place === undefined).map(({ region }) => region);

  return {
    text,
    kept: taken.flatMap(({ region }) => bodyOf(before, region)),
    orphaned: [
      ...orphans.map((region) => ({
        region: region.name,
        lines: bodyOf(before, region).filter(isText),
        why: 'this version has no such region and the tree does not say them',
      })),
      ...withoutTheirRegion({ before, text, regions, places }),
      ...unpairedMarkers(before).map(unpaired),
    ],
  };
}

function unpaired(region: string): OrphanedRegion {
  return {
    region,
    lines: [],
    why: `the marker ddd-ts-kit:${region} has no partner, so what it marked was not read as a region`,
  };
}

/** A region of the template the file does not hold, its markers removed by hand: the lines of the file the text no longer has are those it held, or what this version changed. */
function withoutTheirRegion({ before, text, regions, places }: Unread): OrphanedRegion[] {
  const absent = places.find((place) => !regions.some(({ name }) => name === place.name));
  const lost = before.filter((line) => isText(line) && !REGION_MARKER.test(line) && !text.includes(line.trim()));

  return absent === undefined || lost.length === 0
    ? []
    : [{ region: absent.name, lines: lost, why: 'the file has no such region to read them from' }];
}

interface Unread {
  readonly before: readonly string[];
  readonly text: string;
  readonly regions: readonly Region[];
  readonly places: readonly Region[];
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
