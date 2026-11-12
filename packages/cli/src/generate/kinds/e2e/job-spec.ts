import type { Name } from '../../../naming';
import { renderTemplate } from '../../../templating';
import { named } from '../../named';
import type { Scope } from '../../scope';
import { vars } from '../../vars';
import { jobSlug } from './job-slug';
import type { SendingJob, SendingJobs } from './jobs-sending';
import type { JobStart } from './reaction-of';

/** A function of the end-to-end support a spec starts its use case with. */
export type Support = 'publish' | 'runJob' | 'runDueJobs';

/** The end-to-end spec of a use case its jobs start. */
export interface JobSpec {
  /** Under the name of the use case, or, when `--job` names the job, that name followed by the job: the name of a part of a spec, which leaves the spec of a route alone. */
  readonly file: string;
  readonly content: string;
  /** What the spec calls on the support: `runJob` for a scheduled job, `runDueJobs` for a background one. */
  readonly needs: readonly Support[];
}

const GLOBALS = ['afterAll', 'beforeAll', 'beforeEach', 'describe', 'it'];

/** The spec of a use case its jobs start: one test per job, the scheduled one run at once, the background one with what is due on its queue. */
export function jobSpec(scope: Scope, name: Name, { jobs, e2e }: JobStart): JobSpec {
  const caseOf = (job: SendingJob, template: string): string =>
    renderTemplate(template, vars(scope, { name: named(name), job: { ...job } })).trimEnd();

  const cases = [
    ...jobs.scheduled.map((job) => caseOf(job, 'e2e/e2e-job-case.ts.tpl')),
    ...jobs.background.map((job) => caseOf(job, 'e2e/e2e-background-job-case.ts.tpl')),
  ];

  // A background job runs only once a request enqueued it, which the spec asserts.
  const globals = jobs.background.length === 0 ? GLOBALS : [...GLOBALS, 'expect'].sort();
  const starts = startsOf(scope, name, jobs);

  return {
    file: fileOf(scope, name, jobs),
    content: renderTemplate(
      'e2e/e2e-job.spec.ts.tpl',
      vars(scope, {
        name: named(name),
        e2e: { ...e2e, cases: cases.join('\n\n'), globals: globals.join(', '), starts },
      }),
    ),
    needs: needsOf(jobs),
  };
}

function needsOf(jobs: SendingJobs): Support[] {
  const scheduled: Support[] = jobs.scheduled.length === 0 ? [] : ['runJob'];
  const background: Support[] = jobs.background.length === 0 ? [] : ['runDueJobs'];

  return [...scheduled, ...background];
}

function fileOf(scope: Scope, name: Name, jobs: SendingJobs): string {
  const asked = scope.flags.job === undefined ? [] : [...jobs.scheduled, ...jobs.background].slice(0, 1);

  return `test/e2e/${[name.kebab, ...asked.map((job) => jobSlug(job.className))].join('-')}.e2e.spec.ts`;
}

/** Why the spec runs jobs, said above its tests. */
function startsOf(scope: Scope, name: Name, jobs: SendingJobs): string {
  const lead = scope.flags.job === undefined ? `No route starts "${name.words}"` : `"${name.words}" as a job starts it`;

  const ways = [
    ...(jobs.scheduled.length === 0
      ? []
      : [
          `${namesOf(jobs.scheduled)} sends its command when its schedule is due, so the spec runs the job as the scheduler would`,
        ]),
    ...(jobs.background.length === 0
      ? []
      : [
          `${namesOf(jobs.background)} sends its command once a use case enqueued it, so the spec runs what is due on the queue as the worker would`,
        ]),
  ];

  return `${lead}: ${ways.join('; ')}.`;
}

function namesOf(jobs: readonly SendingJob[]): string {
  return jobs.map((job) => job.name).join(', ');
}
