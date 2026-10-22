import type { AcceptanceProblem } from './acceptance-problem';
import type { Criterion } from './criteria-in';
import type { Scenario } from './scenario';
import type { RowAcceptance } from './story-acceptance';

/** What the story lacks as a whole: rows, a spec, a written scenario for each slice row and each criterion. */
export interface StoryParts {
  readonly story: string;
  readonly file: string;
  readonly text: string | undefined;
  readonly rows: readonly RowAcceptance[];
  readonly criteria: readonly Criterion[];
  readonly scenarios: readonly Scenario[];
  readonly specification: string | undefined;
}

export function storyProblems(parts: StoryParts): AcceptanceProblem[] {
  const { story, file, text, rows } = parts;

  if (rows.length === 0) {
    return [
      {
        kind: 'no-rows',
        at: file,
        message: `No row of docs/architecture/slices.md belongs to ${story}: plan its rows (\`${story}.01\`, ...) before its scenarios name them.`,
        from: 'written',
      },
    ];
  }

  if (text === undefined) {
    return [
      {
        kind: 'no-file',
        at: file,
        message: `${story} has no acceptance spec: \`npx ddd-ts-kit generate acceptance ${story}\`, then one scenario per acceptance criterion.`,
        from: 'written',
      },
    ];
  }

  return [...uncoveredRows(rows), ...uncoveredCriteria(parts)];
}

function uncoveredRows(rows: readonly RowAcceptance[]): AcceptanceProblem[] {
  return rows
    .filter((row) => row.kind === 'slice' && !row.scenarios.some(isWritten))
    .map((row) => ({
      kind: 'uncovered' as const,
      at: `#${row.id}`,
      message: `#${row.id} ${row.slice}: no written scenario names it. Write the scenario of what it lets a client do, its title starting with #${row.id}.`,
      from: 'written' as const,
    }));
}

function uncoveredCriteria({ criteria, scenarios, specification }: StoryParts): AcceptanceProblem[] {
  return criteria
    .filter(({ id }) => !scenarios.some((scenario) => isWritten(scenario) && scenario.criteria.includes(id)))
    .map((criterion) => ({
      kind: 'uncovered-criterion' as const,
      at: `${specification ?? ''}:${criterion.line}`,
      message: `${criterion.id} "${criterion.text}": no written scenario proves it. Write one whose title names ${criterion.id}.`,
      from: 'written' as const,
    }));
}

function isWritten({ state }: Scenario): boolean {
  return state === 'pending' || state === 'active';
}
