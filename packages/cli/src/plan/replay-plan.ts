import fs from 'node:fs';
import type { Slice } from '../progress/slice';
import { copyOfProject } from './copy-of-project';
import { plannedCommands } from './planned-commands';
import { type Judged, plannedWords } from './planned-words';
import { refusedCommand } from './refused-command';
import { type Generate, replayed } from './replay';
import { rowsToPlan } from './rows-to-plan';
import type { PlanProblem } from './wave-plan';
import { waveNumbers } from './wave-numbers';

export interface ReplayRequest {
  /** The context whose rows to replay, with the rows they wait for; null for every row. */
  readonly context: string | null;
  readonly generate: Generate;
}

/**
 * Replays the generator commands of the rows not done, in a copy of the project, in the order of
 * their waves, so that each command finds what the rows before it generate, and says what a
 * worker following each row as written would be refused: a name whose words the glossary does not
 * define, the generator itself saying which names each command introduces, and any command the
 * generator refuses for another reason. Each row's problems come in the order of its commands.
 */
export function replayPlan(root: string, rows: readonly Slice[], request: ReplayRequest): PlanProblem[] {
  const planned = rowsToPlan(rows, request.context);
  const waves = waveNumbers(planned);
  const ordered = [...planned].sort((left, right) => (waves.get(left.id) ?? 0) - (waves.get(right.id) ?? 0));
  const words = plannedWords(root, rows);
  const copy = copyOfProject(root);

  try {
    const generate: Generate = (argv, language) => request.generate([...argv, '--cwd', copy], language);

    const replays = ordered.flatMap((row) =>
      plannedCommands(row.startWith).map((command) => replayed(row, command, { copy, generate })),
    );

    return firstOfEachWord(replays.flatMap((replay, at) => [...words(replay), ...refusedCommand(replays, at)]));
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
}

/** Each word once per row, at the first name that carries it: a name whose words were all said already is left out. */
function firstOfEachWord(problems: readonly (Judged | PlanProblem)[]): PlanProblem[] {
  const said = new Set<string>();

  return problems.flatMap((problem) => {
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
