import type { Rule } from '../model/rule';
import { clearSnapshotValuesIn } from '../privacy/clear-snapshot-values-in';
import { isSnapshotMapper } from '../privacy/is-snapshot-mapper';
import { personalTermOf } from '../privacy/personal-term-of';
import { privacyJudged } from '../privacy/privacy-judged';
import { vocabularyOf } from '../privacy/vocabulary-of';
import { reporter } from '../support/reporter';

const FIX =
  'Seal it as in the events: `personalData(subject, value)` in `encode`, `data.personalText(...)` or `data.personalInstant(...)` in `decode`. Then change `version`: a snapshot of another version is ignored until the next one replaces it. A name that holds nothing of a person in this project is recorded: `// ddd-ts-kit-disable-next-line privacy/snapshot-sealed -- ADR-NNNN: <why>` above it, or the word in `privacy.allow` of ddd-ts-kit.config.json.';

/**
 * A value of a snapshot named like personal data is sealed with `personalData`, as in the events:
 * an erasure destroys the key of the person, and a value in clear outlives it and is loaded back
 * with the aggregate. Read by name in `<aggregate>-snapshots.mapper.ts`, on both sides of the
 * mapper. Silent with `stack.privacy` off.
 */
export const privacySnapshotSealed: Rule = {
  id: 'privacy/snapshot-sealed',
  description:
    'A value of a snapshot named like personal data is sealed with personalData, the only form an erasure reaches.',
  scope: 'project',
  run(project) {
    if (!privacyJudged(project)) {
      return [];
    }

    const vocabulary = vocabularyOf(project.config);
    const report = reporter(project, this.id);

    return project.files.filter(isSnapshotMapper).flatMap((file) =>
      clearSnapshotValuesIn(file).flatMap(({ name, line }) => {
        const term = personalTermOf(name, vocabulary);

        return term === undefined
          ? []
          : [
              report(
                { file: file.path, line },
                `The snapshot keeps ${name} in clear (${term}): an erasure destroys the key of the person and leaves this value, which the aggregate loads back.`,
                FIX,
              ),
            ];
      }),
    );
  },
};
