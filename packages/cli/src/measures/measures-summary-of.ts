import type { MeasuresSummary } from './measures-summary';
import { median } from './median';
import type { StoryMeasures } from './story-measures';

/** The medians and the shares of the period, over the stories measured. */
export function measuresSummaryOf(stories: readonly StoryMeasures[]): MeasuresSummary {
  const design = median(stories.flatMap((story) => story.designHours ?? []));
  const build = median(stories.flatMap((story) => story.buildHours ?? []));
  const lead = median(stories.flatMap((story) => story.leadHours ?? []));

  return {
    stories: stories.length,
    closed: stories.filter((story) => story.leadHours !== undefined).length,
    ...(design === undefined ? {} : { medianDesignHours: design }),
    ...(build === undefined ? {} : { medianBuildHours: build }),
    ...(lead === undefined ? {} : { medianLeadHours: lead }),
    medianCriteriaChanges: median(stories.map((story) => story.rework.criteriaChanges)) ?? 0,
    medianDecisions: median(stories.map((story) => story.decisions)) ?? 0,
    medianCompromises: median(stories.map((story) => story.compromises)) ?? 0,
    medianSettled: median(stories.map((story) => story.review.settled)) ?? 0,
    verified: stories.filter((story) => story.verification).length,
    withOrigin: stories.filter((story) => story.origin !== undefined).length,
    parallel: stories.filter((story) => story.overlaps.length > 0).length,
    repeats: [...new Set(stories.flatMap((story) => story.review.repeats))],
    repeatIncidents: stories.filter((story) => story.repeatIncident !== undefined).length,
  };
}
