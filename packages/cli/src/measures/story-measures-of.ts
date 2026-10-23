import { overlapsOf } from './overlaps-of.js';
import { repeatsAcross } from './repeats-across.js';
import { signaturesOf } from './signatures-of.js';
import type { Span } from './span.js';
import type { StoryMeasures } from './story-measures.js';
import type { StoryReading } from './story-reading.js';

/** The stories with what compares them: the overlaps in time and the repeats of a remark. Authors only when asked. */
export function storyMeasuresOf(readings: readonly StoryReading[], byAuthor: boolean): StoryMeasures[] {
  const overlaps = overlapsOf(readings.flatMap((reading) => spanOf(reading) ?? []));

  const repeats = repeatsAcross(
    new Map(
      readings.map((reading) => [
        reading.history.files.story,
        signaturesOf([...reading.review.remarks, ...reading.review.findingTexts]),
      ]),
    ),
  );

  return readings.map((reading) => {
    const { story } = reading.history.files;

    return measuresOf(reading, byAuthor, {
      overlaps: overlaps.get(story) ?? [],
      repeats: repeats.byStory.get(story) ?? [],
    });
  });
}

function spanOf({ history }: StoryReading): Span | undefined {
  const first = history.commits.all[0];
  const last = history.commits.all.at(-1);

  return first === undefined || last === undefined
    ? undefined
    : { story: history.files.story, from: first.at, to: last.at };
}

function measuresOf(
  reading: StoryReading,
  byAuthor: boolean,
  across: { readonly overlaps: readonly string[]; readonly repeats: readonly string[] },
): StoryMeasures {
  const { history, timeline, rework, report, review, repeatIncident } = reading;
  const { author, ...times } = timeline;
  const { incident: _incident, ...reported } = report;

  return {
    story: history.files.story,
    file: history.files.file,
    ...(byAuthor && author !== undefined ? { author } : {}),
    ...times,
    rework,
    ...reported,
    review: { settled: review.settled, opened: review.opened, findings: review.findings, repeats: across.repeats },
    overlaps: across.overlaps,
    ...(repeatIncident === undefined ? {} : { repeatIncident }),
  };
}
