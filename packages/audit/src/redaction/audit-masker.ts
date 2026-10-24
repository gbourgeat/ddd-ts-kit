import type { AuditScalar } from '@ddd-ts-kit/kernel';
import type { MaskingSubject } from './masking-subject';

/** Turns a value into a token that is equal for equal values and says nothing else. */
export abstract class AuditMasker {
  static readonly tokenKey = 'audit.AuditMasker';

  /** A masker keyed per data subject says so: `auditMiddleware` then refuses, at wiring time, a masked field that names none. */
  readonly requiresDataSubject?: boolean;

  abstract mask(value: AuditScalar, subject: MaskingSubject): string | Promise<string>;
}
