import { identifyError, type AuditRecord, type Logger } from '@ddd-ts-kit/kernel';

/**
 * The `onLostRecord` of a source that writes to the log: a failure whose entry could not be
 * written is then found there, by what was done and why, and by the correlation id the logger
 * adds. It says the type and the code of the failure, never its message, which quotes data.
 */
export function logLostRecords(logger: Logger): (error: unknown, record: AuditRecord | undefined) => void {
  return (error, record) => {
    logger.error('audit entry lost', {
      ...identifyError(error),
      ...(record === undefined ? {} : whatWasDone(record)),
    });
  };
}

function whatWasDone({ category, action, reason }: AuditRecord): Record<string, string> {
  return { category, action, ...(reason === undefined ? {} : { reason }) };
}
