import { CliError } from '../../cli-error.js';
import { CI_EXTRAS, type Config } from '../../config/index.js';

const KNOWN = Object.keys(CI_EXTRAS);

/**
 * The extra jobs of the pipeline: what `--ci-extras` lists (`none` for none), else what the
 * config already records, else none. An unknown name, or a job of a platform the pipeline does
 * not cover, is refused before anything is written.
 */
export function resolveCiExtras(asked: string | undefined, recorded: Config | undefined, ci: string): string[] {
  if (asked === undefined) {
    return [...(recorded?.ci.extras ?? [])];
  }

  const names = asked
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '' && name !== 'none');

  for (const name of names) {
    refuseUnknown(name, ci);
  }

  return [...new Set(names)].sort();
}

function refuseUnknown(name: string, ci: string): void {
  const platform = Object.entries(CI_EXTRAS).find(([known]) => known === name)?.[1];

  if (platform === undefined) {
    throw new CliError(
      `--ci-extras names "${name}", which is no extra job of the pipeline.`,
      `Use a comma-separated list of: ${KNOWN.join(', ')}, or none. docs/CONFIG.md says what each one needs.`,
    );
  }

  if (platform !== 'any' && ci !== platform && ci !== 'both') {
    throw new CliError(
      `--ci-extras ${name} is a job of the ${platform === 'github' ? 'GitHub' : 'GitLab'} pipeline, and --ci is ${ci}.`,
      `Add it with --ci ${platform} or --ci both, or leave it out.`,
    );
  }
}
