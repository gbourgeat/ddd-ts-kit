import type { ErrorReport } from '@ddd-ts-kit/kernel';

/** The tags an issue is searched by. The tenant only when the project asked for it. */
export function tagsOf(report: ErrorReport, tagTenant: boolean): Record<string, string> {
  return {
    origin: report.origin,
    operation: report.operation,
    ...(report.correlationId === undefined ? {} : { correlation_id: report.correlationId }),
    ...(report.context === undefined ? {} : { bounded_context: report.context }),
    ...(report.errorCode === undefined ? {} : { error_code: report.errorCode }),
    ...(tagTenant && report.tenantId !== undefined ? { tenant_id: report.tenantId } : {}),
  };
}
