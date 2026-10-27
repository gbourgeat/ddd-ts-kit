import type { Location } from '../model/location';
import type { Project } from '../model/project';
import type { SourceFile } from '../model/source-file';
import { classesOf } from '../declarations/classes-of';
import { isJobFile } from './is-job-file';

/** A class the application runs on a schedule or in the background, as the file of a context holds it. */
export interface JobClass {
  readonly file: SourceFile;
  readonly name: string;
  readonly line: number;
  /** What the job is called in prose, for messages. */
  readonly kind: 'job' | 'background job';
}

/** The exported class of every job file and every background job file of the project. */
export function jobClasses(project: Project): JobClass[] {
  return project.files.flatMap((file) => {
    const scheduled = isJobFile(file.path, file.location);
    const background = isBackgroundJobFile(file.path, file.location);

    if (file.isTest || (!scheduled && !background)) {
      return [];
    }

    const exported = classesOf(file.scan).find((candidate) => candidate.exported);

    // A file that exports no class is reported by scheduling/job-triggers-use-case.
    return exported === undefined
      ? []
      : [
          {
            file,
            name: exported.name,
            line: exported.line,
            kind: scheduled ? ('job' as const) : ('background job' as const),
          },
        ];
  });
}

/** `application/background/*.background-job.ts` of a context, specs aside. */
function isBackgroundJobFile(file: string, location: Location): boolean {
  if (location.area !== 'context' || location.layer !== 'application' || /\.(?:spec|test)\.ts$/.test(file)) {
    return false;
  }

  return location.inside[0] === 'background' && file.endsWith('.background-job.ts');
}
