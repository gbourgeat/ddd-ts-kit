import type { WorkspaceReport } from '../workspace';
import { isPipelineDefinition } from './is-pipeline-definition';

/** What --force rewrote and what it left to the team, said once the plan is known. */
export function forcedNote({ updated, kept }: WorkspaceReport, dryRun: boolean): string {
  const rewrote = `--force ${dryRun ? 'would rewrite' : 'rewrote'} ${updated.length} file(s) from the templates of this version (listed as updated; git diff shows each change; .gitignore and .dockerignore only gain the lines of the kit they lack)`;

  const pipeline = kept.filter(isPipelineDefinition);

  const whose = pipeline.length === 1 ? 'its' : 'their';

  const yours =
    pipeline.length === 0
      ? ''
      : ` ${pipeline.join(', ')}: ${whose} jobs and includes are yours to edit, those of --ci-extras too.`;

  return kept.length === 0
    ? `${rewrote}.`
    : `${rewrote}, and kept ${kept.length} file(s) yours since the first init (listed as kept): to take what this version writes in one of them, run init in an empty folder and compare.${yours}`;
}
