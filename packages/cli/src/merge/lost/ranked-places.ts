type Place = { readonly file: string; readonly line: number };

/**
 * The places of a missing line on its side, the likeliest to be the missing ones first: in a
 * file where the side has it more often than the base (it added it there), then in a file
 * where the side has it more often than the result (the result dropped it there).
 */
export function rankedPlaces(side: readonly Place[], base: readonly Place[], result: readonly Place[]): Place[] {
  const countIn = (places: readonly Place[], file: string): number =>
    places.filter((place) => place.file === file).length;

  const rank = ({ file }: Place): number =>
    (countIn(side, file) > countIn(base, file) ? 2 : 0) + (countIn(side, file) > countIn(result, file) ? 1 : 0);

  return [...side].sort((one, other) => rank(other) - rank(one));
}
