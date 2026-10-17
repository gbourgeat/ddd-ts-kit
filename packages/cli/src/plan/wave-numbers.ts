import type { Slice } from '../progress/slice.js';

/**
 * The wave of each planned row, by id: 1 when every dependency is done, else one past the latest
 * wave of the dependencies not done. The rows must hold no cycle; a dependency outside them is a
 * done row.
 */
export function waveNumbers(planned: readonly Slice[]): Map<string, number> {
  const byId = new Map(planned.map((row) => [row.id, row]));
  const waves = new Map<string, number>();

  const waveOf = (row: Slice): number => {
    const known = waves.get(row.id);

    if (known !== undefined) {
      return known;
    }

    const earlier = row.dependsOn.flatMap((id) => {
      const dependency = byId.get(id);

      return dependency === undefined ? [] : [waveOf(dependency)];
    });

    const wave = 1 + Math.max(0, ...earlier);

    waves.set(row.id, wave);

    return wave;
  };

  for (const row of planned) {
    waveOf(row);
  }

  return waves;
}
