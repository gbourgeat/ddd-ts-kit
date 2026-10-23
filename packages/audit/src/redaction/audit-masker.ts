import type { AuditScalar } from '@ddd-ts-kit/kernel';
import type { MaskingSubject } from './masking-subject';

/** Turns a value into a token that is equal for equal values and says nothing else. */
export abstract class AuditMasker {
  static readonly tokenKey = 'audit.AuditMasker';

  abstract mask(value: AuditScalar, subject: MaskingSubject): string | Promise<string>;
}
