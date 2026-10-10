const JOB_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*)+$/;

/** A job name is `<context>.<job-name>`, in lower case, words separated by dashes. */
export function isJobName(name: string): boolean {
  return JOB_NAME.test(name);
}
