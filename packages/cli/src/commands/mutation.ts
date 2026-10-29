import { CliError } from '../cli-error';
import { knownCommit } from '../commit/known-commit';
import { type Config, readConfig } from '../config';
import { changedFiles } from '../mutation/changed-files';
import { formatMutation } from '../mutation/format-mutation';
import { formatSurvivors } from '../mutation/format-survivors';
import { MUTATION_REPORT } from '../mutation/mutation-report-file';
import { type ContextScore, mutationScores } from '../mutation/mutation-scores';
import { type MutationReport, readMutationReport } from '../mutation/read-mutation-report';
import { type Survivor, survivors } from '../mutation/survivors';
import { Arguments } from './arguments';
import type { Command } from './command';

/**
 * Holds each layer of each context to the mutation floor of the config: reads the json report the
 * last `stryker run` wrote, scores the domain and application layers of each context as Stryker
 * does (detected over detected and undetected, errors left out), and exits 1 while a layer is under
 * its `mutation.<layer>` floor.
 * `--survivors` lists the mutants no test noticed, each a decision to take; `--changed <ref>`, or
 * `DDD_TS_KIT_MUTATION_SINCE` in the environment as the job of a pull request sets it, lists those
 * of the files changed since the git ref alone and exits 0 whatever the scores, a reading for a
 * change in progress, the floor being held by the run of the night. Runs no test itself:
 * `npm run test:mutation` runs Stryker, then this.
 */
export const mutationCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    report: { type: 'string' },
    survivors: { type: 'boolean', default: false },
    changed: { type: 'string' },
  });

  const root = args.projectRoot;
  const { config } = readConfig(root);
  const report = reportOf(root, args.text('report') ?? MUTATION_REPORT);
  const since = args.text('changed') ?? process.env['DDD_TS_KIT_MUTATION_SINCE'];
  const changed = since === undefined ? undefined : changedSince(root, since);
  const scores = mutationScores(report, config);
  const listed = args.flag('survivors') || changed !== undefined ? survivors(report, config, changed) : undefined;

  io.out(args.json ? asJson(config, scores, listed) : asText(scores, listed, since));

  return changed !== undefined || scores.every((entry) => entry.held) ? 0 : 1;
};

function reportOf(root: string, file: string): MutationReport {
  const report = readMutationReport(root, file);

  if (report === undefined) {
    throw new CliError(
      `No mutation report at ${file}.`,
      'Run `npm run test:mutation`, which runs Stryker on the domain layer of every context and writes the report, then this command; or name the report with --report <file>.',
    );
  }

  return report;
}

function changedSince(root: string, since: string): ReadonlySet<string> {
  const commit = knownCommit(root, since, 'Name a branch, a tag or a commit git knows: `--changed origin/main`.');
  const changed = changedFiles(root, commit);

  if (changed === undefined) {
    throw new CliError(
      `The files changed since ${since} cannot be listed.`,
      'The project is read with git: run the command in a repository and name a ref git knows, such as origin/main.',
    );
  }

  return changed;
}

function asJson(config: Config, scores: readonly ContextScore[], listed: readonly Survivor[] | undefined): string {
  return JSON.stringify(
    { floor: config.mutation, scores, ...(listed === undefined ? {} : { survivors: listed }) },
    null,
    2,
  );
}

function asText(
  scores: readonly ContextScore[],
  listed: readonly Survivor[] | undefined,
  since: string | undefined,
): string {
  if (listed === undefined) {
    return formatMutation(scores);
  }

  const title = since === undefined ? 'Survivors' : `Survivors in the files changed since ${since}`;

  return [formatMutation(scores), '', formatSurvivors(listed, title)].join('\n');
}
