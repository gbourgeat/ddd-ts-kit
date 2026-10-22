import type { Slice } from '../progress/slice';
import { storyOf } from '../story/story-of';
import type { OtherStoryRow, Wave } from './wave-plan';

/**
 * The planned rows that a planned row of another story depends on, in the order of the file: the
 * work of one story that another waits for. Every planned row is not done; a row whose id names no
 * story belongs to none, which is not the story of a row that names one.
 */
export function otherStories(planned: readonly Slice[], waves: readonly Wave[]): OtherStoryRow[] {
  const batchOf = new Map(
    waves.flatMap((wave) => wave.batches.flatMap((batch) => batch.rows.map((row) => [row.id, batch.id] as const))),
  );

  return planned.flatMap((row) => {
    const story = storyOf(row.id) ?? null;

    const waitedForBy = planned
      .filter((other) => other.dependsOn.includes(row.id) && (storyOf(other.id) ?? null) !== story)
      .map((other) => other.id);

    return waitedForBy.length === 0
      ? []
      : [
          {
            id: row.id,
            context: row.context,
            story,
            kind: row.kind,
            slice: row.slice,
            owner: row.owner,
            status: row.status,
            batch: batchOf.get(row.id) ?? null,
            waitedForBy,
          },
        ];
  });
}
