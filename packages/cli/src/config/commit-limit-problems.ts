import { DEFAULT_COMMIT_LIMITS } from './default-commit-limits';
import { isPositiveInteger } from './is-positive-integer';
import { isRecord } from './values/is-record';

/** Something written under `commit` that is not read as written. */
export interface CommitLimitProblem {
  /** The key of the config file the problem sits on. */
  readonly key: string;
  readonly message: string;
  readonly fix: string;
}

const KEYS = ['maxFiles', 'maxLines'] as const;

/** The keys of `commit` that are not limits, each with what it accepts. */
const SWITCHES = ['agentTrailer'] as const;

/** What the raw `commit` value of a config says that the parser replaces by a default or ignores. */
export function commitLimitProblems(value: unknown): CommitLimitProblem[] {
  if (value === undefined) {
    return [];
  }

  if (!isRecord(value)) {
    return [
      {
        key: 'commit',
        message: '"commit" is not an object: the default limits are used.',
        fix: `Write it as ${JSON.stringify(DEFAULT_COMMIT_LIMITS)}, or remove it.`,
      },
    ];
  }

  const wrong = KEYS.filter((key) => value[key] !== undefined && !isPositiveInteger(value[key])).map((key) => ({
    key,
    message: `"commit.${key}" is ${JSON.stringify(value[key])}: it is read as ${DEFAULT_COMMIT_LIMITS[key]}.`,
    fix: `Set "commit.${key}" to a positive integer, or remove it to keep ${DEFAULT_COMMIT_LIMITS[key]}.`,
  }));

  const notBoolean = SWITCHES.filter((key) => value[key] !== undefined && typeof value[key] !== 'boolean').map(
    (key) => ({
      key,
      message: `"commit.${key}" is ${JSON.stringify(value[key])}: it is read as false.`,
      fix: `Set "commit.${key}" to true or false, or remove it to keep false.`,
    }),
  );

  return [...wrong, ...notBoolean, ...unknownKeys(value)];
}

function unknownKeys(value: Record<string, unknown>): CommitLimitProblem[] {
  return Object.keys(value)
    .filter((key) => !KEYS.some((known) => known === key) && !SWITCHES.some((known) => known === key))
    .map((key) => ({
      key,
      message: `"commit.${key}" is not a limit: it is ignored.`,
      fix: `Use only: ${[...KEYS, ...SWITCHES].join(', ')}.`,
    }));
}
