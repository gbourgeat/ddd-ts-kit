import { wholeLiteral } from '../declarations/whole-literal.js';
import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { isJobFile } from '../scheduling/is-job-file.js';
import { jobNames, type JobName } from '../scheduling/job-names.js';
import { perFile } from '../support/per-file.js';
import { callArguments } from '../text/call-arguments.js';

const JOB_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SYSTEM_ACTOR = /(?<![\w$.])systemActor\s*\(/g;
const UNIQUE_FIX = 'Give each job its own name, `<context>.<job-name>`: the scheduler, its lock, its settings and the audit trail all know a job by that name.';

export const schedulingJobName: Rule = {
  id: 'scheduling/job-name',
  description: 'A job is named by a string literal `<context>.<job-name>` in lower-case kebab-case, the context being its own; systemActor(..) of a job file passes that same name; a job name is unique in the project.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      if (file.isTest) return [];

      const names = jobNames(file);

      return [...names.flatMap((name) => misnamed(name, file)), ...otherActors(file, names)];
    });
  },
  acrossProject(project) {
    // Remembers, across the files of the project, where each job name was first written.
    const firstUse = new Map<string, string>();

    return perFile(project, this.id, (file) => (file.isTest ? [] : namesTaken(file, firstUse)));
  },
};

function misnamed({ owner, line, literal }: JobName, file: SourceFile): Finding[] {
  const context = file.location.area === 'context' ? file.location.context : undefined;
  const fix = `Write the name in place as '${context ?? '<context>'}.<job-name>', two segments in lower-case kebab-case: it is the identity of the job in the scheduler, in its lock, in the settings and in the audit trail, so it is written once and never derived.`;

  if (literal === undefined) return [{ line, message: `The name given to ${owner} is not a string literal.`, fix }];
  if (!JOB_NAME.test(literal)) return [{ line, message: `The job name "${literal}" does not follow <context>.<job-name>.`, fix }];
  if (context === undefined || literal.startsWith(`${context}.`)) return [];

  return [{ line, message: `The job name "${literal}" does not start with its context, "${context}".`, fix }];
}

/** In a job file, the system actor is the job: every `systemActor(..)` passes the name the job is declared under. */
function otherActors(file: SourceFile, names: readonly JobName[]): Finding[] {
  const [job] = names;

  if (!isJobFile(file.path, file.location) || job?.literal === undefined) return [];

  const { code } = file.scan;
  const expected = job.literal;

  return [...code.matchAll(SYSTEM_ACTOR)].flatMap((match) => {
    const [argument] = callArguments(code, match.index + match[0].length - 1);

    if (argument !== undefined && wholeLiteral(file.scan, argument) === expected) return [];

    return [{ line: file.scan.lineAt(match.index), message: `systemActor(...) does not pass the name of the job, "${expected}".`, fix: `Write systemActor('${expected}'): the actor of a command sent by a job is the job itself, under the name it is scheduled, logged and audited by.` }];
  });
}

function namesTaken(file: SourceFile, firstUse: Map<string, string>): Finding[] {
  return jobNames(file).flatMap(({ literal, line }) => {
    if (literal === undefined) return [];

    const here = `${file.path}:${line}`;
    const first = firstUse.get(literal);

    if (first === undefined) firstUse.set(literal, here);

    return first === undefined ? [] : [{ line, message: `The job name "${literal}" is already used in ${first}.`, fix: UNIQUE_FIX }];
  });
}
