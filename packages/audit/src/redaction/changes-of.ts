import type { AuditChange, AuditChanges, AuditScalar } from '@ddd-ts-kit/kernel';
import type { AuditMasker } from './audit-masker';
import type { AuditProjection } from './audit-projection';
import type { MaskingSubject } from './masking-subject';
import { MissingMaskerError } from './missing-masker-error';

export interface Redaction {
  readonly masker?: AuditMasker;
  readonly subject: Omit<MaskingSubject, 'field'>;
}

/** The `changes` of an entry, or `undefined` when the projection kept nothing. */
export async function changesOf(projection: AuditProjection, redaction: Redaction): Promise<AuditChanges | undefined> {
  const changes: Record<string, AuditChange> = {};

  for (const [field, value] of Object.entries(projection.plain ?? {})) {
    const scalar = scalarOf(value);

    if (scalar !== undefined) {
      changes[field] = scalar;
    }
  }

  for (const [field, value] of Object.entries(projection.masked ?? {})) {
    const scalar = scalarOf(value);
    const dataSubject = projection.subjects?.[field];

    if (scalar !== undefined) {
      changes[field] = await maskOf(scalar, field, {
        ...redaction,
        ...(dataSubject === undefined ? {} : { dataSubject }),
      });
    }
  }

  return Object.keys(changes).length === 0 ? undefined : changes;
}

function scalarOf(value: unknown): AuditScalar | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  return value instanceof Date ? value.toISOString() : undefined;
}

type Masking = Redaction & { readonly dataSubject?: string };

async function maskOf(
  value: AuditScalar,
  field: string,
  { masker, subject, dataSubject }: Masking,
): Promise<AuditChange> {
  if (masker === undefined) {
    throw new MissingMaskerError(field);
  }

  return {
    masked: await masker.mask(value, { ...subject, field, ...(dataSubject === undefined ? {} : { dataSubject }) }),
  };
}
