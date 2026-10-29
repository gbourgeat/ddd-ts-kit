import fs from 'node:fs';
import type { Slice } from '../progress/slice';
import { copyOfProject } from './copy-of-project';
import { cyclesOf } from './cycles-of';
import { missingDependencies } from './missing-dependencies';
import { plannedCommands } from './planned-commands';
import { type Judged, plannedWords } from './planned-words';
import { refusedCommand } from './refused-command';
import { type Generate, type InCopy, type Replay, replayed } from './replay';
import { isStarted } from './is-started';
import { replayedPlan } from './replayed-plan';
import { rowsToPlan } from './rows-to-plan';
import type { PlanProblem, StartedRefusal } from './wave-plan';
import { waveNumbers } from './wave-numbers';

export interface ReplayRequest {
  /** The context whose rows to judge, with the rows they wait for; null for every row. Every open row is replayed. */
  readonly context: string | null;
  readonly generate: Generate;
}

/** What the replay of the plan found. */
export interface ReplayFindings {
  /** What a worker following a row as written would meet, in the order of the rows and of their commands. */
  readonly problems: readonly PlanProblem[];
  /** What the generator refused in rows in progress. */
  readonly started: readonly StartedRefusal[];
}

/**
 * Replays the generator commands of the rows not done, in a copy of the project, in the order of
 * their waves, so that each command finds what the rows before it generate, and says what a
 * worker following each row as written would be refused: a name whose words the glossary does not
 * define, the generator itself saying which names each command introduces; any command the
 * generator refuses for another reason; a file it builds on that a row it does not wait for
 * generates, the generator saying what each command builds on and creates. With a context, the
 * rows of the other contexts are replayed too, so that a row finds what a row of another context
 * it does not wait for generates, but only the rows of its plan are judged.
 */
export function replayPlan(root: string, rows: readonly Slice[], request: ReplayRequest): ReplayFindings {
  const judged = new Set(rowsToPlan(rows, request.context));
  const replayedRows = rowsToReplay(rows, judged);
  const waves = waveNumbers(replayedRows);
  const ordered = [...replayedRows].sort((left, right) => (waves.get(left.id) ?? 0) - (waves.get(right.id) ?? 0));
  const commands = ordered.flatMap((row) => plannedCommands(row.startWith).map((command) => ({ row, command })));

  // Nothing to judge: no copy of the project to make.
  if (!commands.some(({ row }) => judged.has(row))) {
    return { problems: [], started: [] };
  }

  const words = plannedWords(root, rows);
  const copy = copyOfProject(root);

  try {
    const inCopy: InCopy = { copy, generate: (argv, probe) => request.generate([...argv, '--cwd', copy], probe) };
    const replays = commands.map(({ row, command }) => replayed(row, command, inCopy));

    const plan = replayedPlan(rows, replays);

    // Run again with --dry-run: the copy stays as the plan left it, and what one rerun writes never makes another pass.
    const again = (replay: Replay): Replay =>
      replayed(replay.row, { text: replay.command, argv: replay.argv }, { ...inCopy, dryRun: true });

    const problems = replays.flatMap((replay, at) =>
      judged.has(replay.row)
        ? [...words(replay), ...refusedCommand(plan, at, again), ...missingDependencies(plan, at)]
        : [],
    );

    return {
      problems: onceEach(problems),
      started: replays.filter(({ row }) => judged.has(row)).flatMap(startedRefusal),
    };
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
}

/**
 * Every open row of the file, those of other contexts too, when they can be ordered; else, a cycle
 * or an id two of them carry, the rows judged alone, which the plan of their context ordered.
 */
function rowsToReplay(rows: readonly Slice[], judged: ReadonlySet<Slice>): readonly Slice[] {
  const open = rowsToPlan(rows, null);
  const orderable = new Set(open.map(({ id }) => id)).size === open.length && cyclesOf(open).length === 0;

  return orderable ? open : [...judged];
}

function startedRefusal({ row, command, refusal }: Replay): StartedRefusal[] {
  return refusal === undefined || !isStarted(row)
    ? []
    : [{ row: row.id, command, refusal: refusal.message, fix: refusal.fix }];
}

/**
 * Each word once per row, at the first name that carries it, a name whose words were all said
 * already left out; each row a row does not wait for once, at the first command that needs it.
 */
function onceEach(problems: readonly (Judged | PlanProblem)[]): PlanProblem[] {
  const said = new Set<string>();

  return problems.flatMap((problem): PlanProblem[] => {
    if (problem.kind === 'missing-dependency') {
      const key = `${problem.kind} ${problem.rows.join()}`;
      const fresh = !said.has(key);

      said.add(key);

      return fresh ? [problem] : [];
    }

    if (!('words' in problem)) {
      return [problem];
    }

    const { words, ...named } = problem;
    const fresh = words.filter((word) => !said.has(`${named.kind} ${named.rows.join()} ${word}`));

    for (const word of fresh) {
      said.add(`${named.kind} ${named.rows.join()} ${word}`);
    }

    return fresh.length === 0 ? [] : [named];
  });
}
