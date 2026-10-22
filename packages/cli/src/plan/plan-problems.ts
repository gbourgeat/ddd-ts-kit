import type { Slice } from '../progress/slice';
import { cyclesOf } from './cycles-of';
import type { PlanProblem } from './wave-plan';

/**
 * What keeps the planned rows from being ordered, among `rows`, every row of the file: an id
 * two rows carry, a dependency on an id no row carries, a row without owner, a cycle.
 */
export function planProblems(rows: readonly Slice[], planned: readonly Slice[]): PlanProblem[] {
  return [
    ...duplicated(rows, planned),
    ...unknownDependencies(rows, planned),
    ...ownerless(planned),
    ...cyclesOf(planned).map(cycleProblem),
  ];
}

function duplicated(rows: readonly Slice[], planned: readonly Slice[]): PlanProblem[] {
  const ids = [...new Set(planned.flatMap((row) => [row.id, ...row.dependsOn]))];

  return ids.flatMap((id) => {
    const count = rows.filter((row) => row.id === id).length;

    return count < 2
      ? []
      : [
          {
            kind: 'duplicate-id' as const,
            rows: [id],
            message: `#${id} is the number of ${count} rows: give each row its own number`,
          },
        ];
  });
}

function unknownDependencies(rows: readonly Slice[], planned: readonly Slice[]): PlanProblem[] {
  const known = new Set(rows.map((row) => row.id));

  return planned.flatMap((row) =>
    row.dependsOn
      .filter((id) => !known.has(id))
      .map((id) => ({
        kind: 'unknown-dependency' as const,
        rows: [row.id, id],
        message: `#${row.id} depends on #${id}, which no row carries`,
      })),
  );
}

function ownerless(planned: readonly Slice[]): PlanProblem[] {
  return planned
    .filter((row) => row.owner === '')
    .map((row) => ({
      kind: 'no-owner' as const,
      rows: [row.id],
      message: `#${row.id} has no owner: conductor, the name of a context, or a person`,
    }));
}

/** `cycle: #2 depends on #3, which depends on #2`. */
function cycleProblem(cycle: readonly string[]): PlanProblem {
  const [first, ...rest] = cycle.map((id) => `#${id}`);

  return {
    kind: 'cycle',
    rows: cycle,
    message: `cycle: ${first ?? ''} depends on ${rest.join(', which depends on ')}: none of them can start`,
  };
}
