/** The armed timeouts of an instance, as the store wrote them: the id of a job by name. */
export function timeoutsOf(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('The timeouts of a process instance are not written the way the store writes them.');
  }

  return Object.fromEntries(
    Object.entries(value).map(([name, jobId]: [string, unknown]) => {
      if (typeof jobId !== 'string') {
        throw new TypeError(`The timeout "${name}" of a process instance names no job.`);
      }

      return [name, jobId];
    }),
  );
}
