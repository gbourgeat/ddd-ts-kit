import { durationText } from './duration-text';
import type { MeasuresSummary } from './measures-summary';
import type { MeasuresView } from './measures-view';
import { storyLineOf } from './story-line-of';

/** The measures as text: one line per story, then the medians and the shares of the period. */
export function formatMeasures(view: MeasuresView): string {
  const period = view.since === undefined ? '' : ` since ${view.since}`;
  const head = `Measures of ${view.branch === 'none' ? 'the repository (no branch)' : view.branch}${period}: ${count(view.summary.stories, 'story', 'stories')}, ${view.summary.closed} closed (merged on this branch).`;
  const notComputed = view.notComputed.map((measure) => `Not computed: ${measure}.`);

  if (view.stories.length === 0) {
    return [head, 'No story file in docs/architecture/stories/ for this period.', ...notComputed].join('\n');
  }

  return [
    head,
    '',
    ...view.stories.map((story) => `  ${storyLineOf(story)}`),
    '',
    ...summaryLines(view.summary),
    ...authorLines(view),
    ...notComputed,
  ].join('\n');
}

function summaryLines(summary: MeasuresSummary): string[] {
  const repeats = summary.repeats.length === 0 ? 'none' : `${summary.repeats.length} (${summary.repeats.join('; ')})`;

  return [
    `Medians: design ${durationText(summary.medianDesignHours)}, build ${durationText(summary.medianBuildHours)}, lead ${durationText(summary.medianLeadHours)} over ${summary.closed} closed; ${summary.medianCriteriaChanges} criteria change(s), ${summary.medianDecisions} decision(s), ${summary.medianCompromises} compromise(s), ${summary.medianSettled} marker(s) settled per story.`,
    `Verification: ${summary.verified} of ${summary.stories} report(s) name \`npm run verify\`. Origin: ${summary.withOrigin} of ${summary.stories} name an intent, a ticket or an incident. Parallel: ${summary.parallel} built while another one was. Repeats across stories: ${repeats}. Repeat incidents: ${summary.repeatIncidents}.`,
  ];
}

function authorLines(view: MeasuresView): string[] {
  if (view.byAuthor === undefined) {
    return [];
  }

  return [
    'By author (asked for with --by-author: a measure read per person changes what people do):',
    ...Object.entries(view.byAuthor).map(
      ([author, measures]) =>
        `  ${author}  ${count(measures.stories, 'story', 'stories')}, ${measures.closed} closed, lead ${durationText(measures.medianLeadHours)}`,
    ),
  ];
}

function count(number: number, singular: string, plural: string): string {
  return `${number} ${number === 1 ? singular : plural}`;
}
