import { CI_EXTRAS } from './ci-extras';
import type { CommitLimitProblem } from './commit-limit-problems';
import { isRecord } from './values/is-record';

const KNOWN = Object.keys(CI_EXTRAS);

/** What the raw `ci` value of a config says that no pipeline does. */
export function ciExtraProblems(value: unknown): CommitLimitProblem[] {
  if (value === undefined) {
    return [];
  }

  const extras = isRecord(value) ? value['extras'] : undefined;

  if (!Array.isArray(extras)) {
    return [
      {
        key: 'ci',
        message: '"ci" is not an object holding a list "extras": no extra job is read from it.',
        fix: `Write it as { "extras": [] }, naming any of: ${KNOWN.join(', ')}; or remove it.`,
      },
    ];
  }

  return extras
    .filter((extra) => typeof extra !== 'string' || !KNOWN.includes(extra))
    .map((extra) => ({
      key: 'extras',
      message: `"ci.extras" names ${JSON.stringify(extra)}, which is no extra job of the pipeline.`,
      fix: `Use only: ${KNOWN.join(', ')} (docs/CONFIG.md says what each one needs).`,
    }));
}
