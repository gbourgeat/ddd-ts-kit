import type { AcceptanceGate } from './acceptance-gate.js';
import { countsFor } from './counts-for.js';
import type { RowAcceptance, StoryAcceptance } from './story-acceptance.js';

/** The acceptance of each story as text: its spec, each row with its scenarios, then what keeps it from the gate. */
export function formatAcceptance(stories: readonly StoryAcceptance[], gate: AcceptanceGate | undefined): string {
  if (stories.length === 0) {
    return 'No story: docs/architecture/slices.md has no row and test/acceptance/ no spec.';
  }

  return stories.map((story) => formatStory(story, gate)).join('\n\n');
}

function formatStory(story: StoryAcceptance, gate: AcceptanceGate | undefined): string {
  const problems = story.problems.filter((problem) => countsFor(problem, gate));

  const verdict =
    gate === undefined
      ? []
      : [problems.length === 0 ? `  gate ${gate}: met` : `  gate ${gate}: ${problems.length} left`];

  return [
    `${story.story}  ${story.file ?? '(no acceptance spec)'}${story.lock === undefined ? '' : ', locked'}`,
    ...(story.specification === undefined ? [] : [`  specification ${story.specification}: ${criteriaOf(story)}`]),
    ...story.rows.map((row) => `  #${row.id} ${row.kind} "${row.slice}" (${row.status}): ${scenariosOf(row)}`),
    ...story.amendments.map(
      (amendment) =>
        `  amended on ${amendment.on}, for the owner to validate: ${amendment.subject} (${amendment.verdict}): ${amendment.reason}`,
    ),
    ...problems.map((problem) => `  ${problem.at}  ${problem.message}`),
    ...verdict,
  ].join('\n');
}

function criteriaOf({ criteria, scenarios }: StoryAcceptance): string {
  if (criteria.length === 0) {
    return 'no acceptance criterion stated';
  }

  const proved = criteria.filter(({ id }) => scenarios.some((scenario) => scenario.criteria.includes(id))).length;

  return `${criteria.length} criteria, ${proved} named by a scenario`;
}

function scenariosOf(row: RowAcceptance): string {
  if (row.scenarios.length === 0) {
    return row.kind === 'slice' ? 'no scenario' : 'no scenario needed';
  }

  const states = ['active', 'pending', 'todo', 'skipped'].flatMap((state) => {
    const count = row.scenarios.filter((scenario) => scenario.state === state).length;

    return count === 0 ? [] : [`${count} ${state}`];
  });

  return `${row.scenarios.length} scenario${row.scenarios.length === 1 ? '' : 's'}, ${states.join(', ')}`;
}
