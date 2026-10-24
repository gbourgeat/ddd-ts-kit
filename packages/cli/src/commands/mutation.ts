import { CliError } from '../cli-error';
import { readConfig } from '../config';
import { formatMutation } from '../mutation/format-mutation';
import { MUTATION_REPORT } from '../mutation/mutation-report-file';
import { readMutationReport } from '../mutation/read-mutation-report';
import { mutationScores } from '../mutation/mutation-scores';
import { Arguments } from './arguments';
import type { Command } from './command';

/**
 * Holds each context to the mutation floor of the config: reads the json report the last
 * `stryker run` wrote, scores the domain layer of each context as Stryker does (detected over
 * detected and undetected, errors left out), and exits 1 while a context is under `mutation.domain`.
 * Runs no test itself: `npm run test:mutation` runs Stryker, then this.
 */
export const mutationCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { report: { type: 'string' } });
  const root = args.projectRoot;
  const { config } = readConfig(root);
  const file = args.text('report') ?? MUTATION_REPORT;
  const report = readMutationReport(root, file);

  if (report === undefined) {
    throw new CliError(
      `No mutation report at ${file}.`,
      'Run `npm run test:mutation`, which runs Stryker on the domain layer of every context and writes the report, then this command; or name the report with --report <file>.',
    );
  }

  const scores = mutationScores(report, config);

  io.out(args.json ? JSON.stringify({ floor: config.mutation, scores }, null, 2) : formatMutation(scores));

  return scores.every((entry) => entry.held) ? 0 : 1;
};
