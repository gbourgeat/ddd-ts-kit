import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import { type JobClass, jobClasses } from '../scheduling/job-classes';
import { escapeRegExp } from '../text/escape-reg-exp';
import { isDeclaredStyle } from '../support/is-declared-style';
import { reporter } from '../support/reporter';

/**
 * A job class nobody registers never runs: the scheduler runs what the module files register, and
 * a class in `application/scheduling/` or `application/background/` that no registration names is
 * dead code that every spec and every other rule passes. Judged on the exported class of each job
 * file and background job file, in the explicit style: some other file outside the tests names it
 * in `.handledBy(`, in `.register(` or builds it with `new`. The declared style registers a class
 * by its decorator, which `declarations/role-declared` requires. A class the project registers
 * by a loop, a list or any form the checker does not read is reported too: write the plain forms.
 */
export const schedulingJobRegistered: Rule = {
  id: 'scheduling/job-registered',
  description:
    'Every job (application/scheduling/*.job.ts) and background job (application/background/*.background-job.ts) is registered by a module file, in the explicit style.',
  scope: 'project',
  run(project) {
    // In the declared style a class without its decorator is reported by declarations/role-declared.
    if (isDeclaredStyle(project)) {
      return [];
    }

    const report = reporter(project, this.id);

    return jobClasses(project)
      .filter((job) => !isRegistered(project, job))
      .map((job) =>
        report(
          { file: job.file.path, line: job.line },
          `${job.name} is not registered: the application never runs this ${job.kind}.`,
          registrationFix(job),
        ),
      );
  },
};

function isRegistered(project: Project, job: JobClass): boolean {
  const name = escapeRegExp(job.name);
  const registration = new RegExp(`(?:\\.\\s*(?:handledBy|register)\\s*\\(\\s*|\\bnew\\s+)${name}\\b`);

  return project.files.some((file) => file !== job.file && !file.isTest && registration.test(file.scan.code));
}

function registrationFix(job: JobClass): string {
  if (job.kind === 'job') {
    return `Register ${job.name} in the module file of its context: \`platform.jobs.register({ name, schedule, run })\` in registerJobs (explicit style), or \`builder.job('<context>.<name>', { every: .. }).handledBy(${job.name}, [CommandBus])\` in the module of the dependency injection. Generating the job writes this registration; a job written by hand needs it.`;
  }

  return `Register ${job.name} in the module file of its context: \`platform.backgroundJobs.register(${job.name}, [platform.commands])\` in registerJobs (explicit style), or \`builder.backgroundJob(${job.name}.jobName).handledBy(${job.name}, [CommandBus])\` in the module of the dependency injection.`;
}
