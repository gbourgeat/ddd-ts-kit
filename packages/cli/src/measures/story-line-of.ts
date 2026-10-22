import { durationText } from './duration-text';
import type { StoryMeasures } from './story-measures';

/** One story as a line of the text output. */
export function storyLineOf(story: StoryMeasures): string {
  return [
    story.story,
    story.opened === undefined ? 'not committed' : `opened ${story.opened.slice(0, 10)}`,
    `design ${durationText(story.designHours)}`,
    `build ${durationText(story.buildHours)}`,
    story.leadHours === undefined
      ? 'lead open'
      : `lead ${durationText(story.leadHours)} (merged ${story.merged ?? ''})`,
    `rework ${story.rework.criteriaChanges} criteria change(s), ${story.rework.amendments} amendment(s), ${story.rework.refusals} refusal(s)`,
    `decisions ${story.decisions}`,
    `compromises ${story.compromises}`,
    reviewText(story),
    `verification ${story.verification ? 'yes' : 'no'}`,
    `origin ${story.origin ?? 'none'}${story.repeatIncident === undefined ? '' : ` (repeats ${story.repeatIncident})`}`,
    story.overlaps.length === 0 ? 'alone in time' : `overlaps ${story.overlaps.join(', ')}`,
    ...(story.author === undefined ? [] : [`by ${story.author}`]),
  ].join('  ');
}

function reviewText({ review }: StoryMeasures): string {
  const findings = Object.entries(review.findings).map(([pass, number]) => `${number} ${pass}`);
  const found = findings.length === 0 ? '' : `, findings ${findings.join(', ')}`;
  const repeats = review.repeats.length === 0 ? '' : `, repeats ${review.repeats.join('; ')}`;

  return `review ${review.settled} settled, ${review.opened} opened${found}${repeats}`;
}
