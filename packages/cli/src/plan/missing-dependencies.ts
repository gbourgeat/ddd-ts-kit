import type { ReplayedPlan } from './replayed-plan';
import type { MissingDependency } from './wave-plan';

/**
 * The files the command replayed at `at` builds on that a row it does not wait for generates:
 * the replay runs every row in one copy, one after the other, and found them; the worker of the
 * row, on a branch of its own, would be refused. One problem for each row that generates one.
 */
export function missingDependencies(plan: ReplayedPlan, at: number): MissingDependency[] {
  const replay = plan.replays[at];

  if (replay === undefined) {
    return [];
  }

  const { row, command } = replay;
  const said = new Set<string>();

  return replay.builtOn.flatMap((file) => {
    const by = plan.creatorOf(file);
    const creator = by === undefined ? undefined : plan.replays[by]?.row;

    if (creator === undefined || creator === row || plan.waitsFor(row, creator) || said.has(creator.id)) {
      return [];
    }

    said.add(creator.id);

    return [
      {
        kind: 'missing-dependency' as const,
        rows: [row.id, creator.id],
        command,
        builtOn: file,
        message: `#${row.id} \`${command}\` builds on \`${file}\`, which #${creator.id} generates: add ${creator.id} to its Depends on, or its worker, on a branch of its own, is refused`,
      },
    ];
  });
}
