import { describe, expect, it } from 'vitest';
import * as kernel from '@ddd-ts-kit/kernel';
import { describeToken, tokenIdentity } from '@ddd-ts-kit/kernel/declarations';
import { AuditMasker, AuditReader, AuditTrail, InMemoryAuditTrail, hmacMasker } from '../src/index.js';

describe('the ports of the audit trail', () => {
  it('gives the trail and the reader as the classes of the kernel, which are their injection tokens', () => {
    expect(AuditTrail).toBe(kernel.AuditTrail);
    expect(AuditReader).toBe(kernel.AuditReader);
  });

  it('is implemented, both ports at once, by the in-memory trail', () => {
    const trail: AuditTrail & AuditReader = new InMemoryAuditTrail();

    expect(trail).toBeInstanceOf(InMemoryAuditTrail);
  });

  it('declares the masker as a port of its own, with a key that survives two copies of the package', () => {
    const masker: AuditMasker = hmacMasker('secret');

    expect(describeToken(AuditMasker)).toBe('AuditMasker');
    expect(tokenIdentity(AuditMasker)).toBe(tokenIdentity(class AuditMasker { static readonly tokenKey = 'audit.AuditMasker' }));
    expect(masker.mask('lin@example.org', { field: 'patientEmail', actorId: 'ada' })).toMatch(/^[0-9a-f]{64}$/);
  });
});
