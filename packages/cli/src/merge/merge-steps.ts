import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { acceptInMergeMessage } from './accept-in-merge-message';
import { landDrizzle } from './land-drizzle';
import type { MergeContext } from './merge-context';
import type { MergeReport } from './merge-report';
import type { MergeState, MergeStep } from './merge-state';
import { NEXT_STEPS } from './next-steps';
import { renumberAdrs } from './renumber-adrs';
import { renumberMigrations } from './renumber-migrations';

/** What one step gave: the report with what it did, and why the merge stops when it does. */
export interface StepOutcome {
  readonly report: MergeReport;
  readonly stop?: { readonly why: string; readonly next: string };
}

const TAIL_LINES = 20;

/**
 * The steps run once after the conflicts are settled, in their order: the install the lockfile
 * needs, the migrations (replayed under drizzle-kit, renamed on `--to-land` elsewhere), the
 * decision records renumbered.
 */
export const MERGE_STEPS: Readonly<
  Record<MergeStep, (context: MergeContext, state: MergeState, now: Date) => StepOutcome>
> = {
  install(context, { report, install }) {
    if (!install) {
      return { report };
    }

    const manager =
      context.config?.stack.packageManager ??
      (fs.existsSync(path.join(context.root, 'pnpm-lock.yaml')) ? 'pnpm' : 'npm');

    const run = spawnSync(manager, ['install'], {
      cwd: context.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (run.status !== 0) {
      const output = `${run.stdout}${run.stderr}`.trimEnd().split('\n').slice(-TAIL_LINES).join('\n');

      return {
        report: { ...report, migrations: report.migrations },
        stop: { why: `\`${manager} install\` failed:\n${output}`, next: NEXT_STEPS.install },
      };
    }

    const how = `installed again with \`${manager} install\`: the branch changed package.json since the base`;

    return {
      report: { ...report, automatic: [...report.automatic, { file: lockfileOf(manager), kind: 'lockfile', how }] },
    };
  },

  migrations(context, state, now) {
    const { report } = state;
    const orm = context.config?.stack.orm;
    const sides = { base: report.base.commit, trunk: report.trunk.commit };

    const landed =
      orm === 'drizzle'
        ? landDrizzle(context.root, { ...sides, ours: state.ours, toLand: state.toLand })
        : (orm === 'knex' || orm === 'prisma' || orm === 'typeorm') && state.toLand
          ? renumberMigrations({ root: context.root, orm, ...sides, now })
          : { lines: [] };

    const next = { ...report, migrations: [...report.migrations, ...landed.lines] };

    return landed.stop === undefined
      ? { report: next }
      : { report: next, stop: { why: landed.stop, next: NEXT_STEPS.migrations } };
  },

  adrs(context, { report, ours }) {
    const renumbered = renumberAdrs(context.root, { base: report.base.commit, ours, trunk: report.trunk.commit });

    acceptInMergeMessage(
      context.repo.top,
      renumbered.rewritten.map((entry) => `${context.repo.prefix}${entry}`),
    );

    return { report: { ...report, automatic: [...report.automatic, ...renumbered.settled] } };
  },
};

function lockfileOf(manager: string): string {
  return manager === 'pnpm' ? 'pnpm-lock.yaml' : 'package-lock.json';
}
