import { hkdfSync } from 'node:crypto';
import { isTenantId, type AuditScalar, type SubjectKeyStore } from '@ddd-ts-kit/kernel';
import type { AuditMasker } from './audit-masker';
import { hmacMasker } from './hmac-masker';
import type { MaskingSubject } from './masking-subject';
import { MaskingSubjectNotAnIdError } from './masking-subject-not-an-id-error';
import { MissingDataSubjectError } from './missing-data-subject-error';

export interface SubjectMaskerOptions {
  /** Mixed into the derivation of the masking key, so that the masks of the trail and any other use of the key of a person never share a secret. Default `audit-mask`. */
  readonly label?: string;
}

const LABEL = 'audit-mask';
const KEY_BYTES = 32;

/**
 * HMAC-SHA-256 under a key derived (HKDF) from the key of the data subject the value belongs to,
 * the one `PersonalDataCipher` seals the stored events with, created on first use. Two entries
 * about the same person carry the same mask while the key lives, so "every entry about this
 * person" is still answered by masking the value again; erasing the person (`SubjectKeyStore.erase`)
 * destroys the key, and every mask made with it becomes a token nobody can recompute: the entries
 * stay, the chain stays valid, the person is gone. The mask is written `<keyId>:<hex>`, so a mask
 * of a key that is gone is told from the others. Each masked field has to name whose value it is,
 * `masked('patientEmail', { subject: 'patientId' })`: `auditMiddleware` refuses one that does not,
 * at wiring time; and that subject has to be an opaque identifier, the grammar of a tenant id,
 * since the key store writes it in clear: a name or an email in its place is refused before any
 * key is created.
 */
export function subjectMasker(keys: SubjectKeyStore, options: SubjectMaskerOptions = {}): AuditMasker {
  const label = options.label ?? LABEL;

  return {
    requiresDataSubject: true,
    mask: async (value: AuditScalar, subject: MaskingSubject): Promise<string> => {
      if (subject.dataSubject === undefined) {
        throw new MissingDataSubjectError(subject.field);
      }

      if (!isTenantId(subject.dataSubject)) {
        throw new MaskingSubjectNotAnIdError(subject.field);
      }

      const key = await keys.keyFor(subject.dataSubject);
      const secret = hkdfSync('sha256', Buffer.from(key.material, 'base64'), '', label, KEY_BYTES);

      return hmacMasker(new Uint8Array(secret), { keyId: key.id }).mask(value, subject);
    },
  };
}
