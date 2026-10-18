import type { AcceptanceProblem } from './acceptance-problem.js';
import type { Scenario } from './scenario.js';

/** What a scenario needs to be judged: the rows of slices.md, those done, the criteria of its story. */
export interface ScenarioContext {
  readonly file: string;
  readonly knownRows: ReadonlySet<string>;
  readonly doneRows: ReadonlySet<string>;
  /** The ids of the criteria of the story; empty when its specification states none. */
  readonly criteria: ReadonlySet<string>;
}

export function scenarioProblems(scenario: Scenario, context: ScenarioContext): AcceptanceProblem[] {
  const at = `${context.file}:${scenario.line}`;
  const quoted = `"${scenario.title}"`;

  if (scenario.state === 'todo') {
    return [{ kind: 'todo', at, message: `${quoted} is still an it.todo: write the scenario.`, from: 'written' }];
  }

  if (scenario.state === 'skipped') {
    return [
      {
        kind: 'skipped',
        at,
        message: `${quoted} is put aside by the runner: an acceptance scenario runs, wrapped in pending(...) until its code is built.`,
      },
    ];
  }

  const judged = { at, quoted, scenario };

  return [...rowProblems(judged, context), ...criterionProblems(judged, context), ...pendingProblems(judged, context)];
}

/** A written scenario, where it is and how a message quotes it. */
interface Judged {
  readonly at: string;
  readonly quoted: string;
  readonly scenario: Scenario;
}

function rowProblems({ at, quoted, scenario }: Judged, { knownRows }: ScenarioContext): AcceptanceProblem[] {
  if (scenario.rows.length === 0) {
    return [
      {
        kind: 'no-row',
        at,
        message: `${quoted} names no row: start its title with the id of the row that makes it pass (#US5.02).`,
      },
    ];
  }

  return scenario.rows
    .filter((id) => !knownRows.has(id))
    .map((id) => ({
      kind: 'unknown-row' as const,
      at,
      message: `${quoted} names #${id}, which no row of docs/architecture/slices.md carries.`,
    }));
}

function criterionProblems({ at, quoted, scenario }: Judged, { criteria }: ScenarioContext): AcceptanceProblem[] {
  if (criteria.size === 0) {
    return [];
  }

  if (scenario.criteria.length === 0) {
    return [
      {
        kind: 'no-criterion',
        at,
        message: `${quoted} names no acceptance criterion: put the one it proves after its row (#US5.02 AC1 ...).`,
        from: 'written',
      },
    ];
  }

  return scenario.criteria
    .filter((id) => !criteria.has(id))
    .map((id) => ({
      kind: 'unknown-criterion' as const,
      at,
      message: `${quoted} names ${id}, which the specification of the story does not state.`,
    }));
}

function pendingProblems({ at, quoted, scenario }: Judged, { doneRows }: ScenarioContext): AcceptanceProblem[] {
  if (scenario.state !== 'pending') {
    return [];
  }

  if (scenario.rows.length > 0 && scenario.rows.every((id) => doneRows.has(id))) {
    return [
      {
        kind: 'done-pending',
        at,
        message: `${quoted} is still pending, and every row it names is done: build what it waits for, or remove pending(...) once it passes.`,
      },
    ];
  }

  return [{ kind: 'pending', at, message: `${quoted} is pending: its code is not built yet.`, from: 'passing' }];
}
