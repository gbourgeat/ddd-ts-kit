import { describe, expect, it } from 'vitest';
import {
  FileError,
  FixedClock,
  FixedExecutionScope,
  InvalidTenantIdError,
  SequentialIdGenerator,
  TenantFileKeys,
  executionContext,
  isFileKey,
  systemActor,
} from '../src';

const clock = new FixedClock(new Date('2026-03-01T10:00:00.000Z'));

function scopeOf(tenantId?: string): FixedExecutionScope {
  const context = executionContext({
    correlationId: 'c-1',
    actor: systemActor('test'),
    origin: 'test',
    ...(tenantId === undefined ? {} : { tenantId }),
  });

  return new FixedExecutionScope(context);
}

describe('TenantFileKeys', () => {
  it('names a file by its area, its month and a generated id', () => {
    const keys = new TenantFileKeys(new SequentialIdGenerator('file'), clock);

    expect([keys.next('appointment-documents'), keys.next('exports')]).toEqual([
      'appointment-documents/2026/03/file-1',
      'exports/2026/03/file-2',
    ]);
  });

  it('puts the files of a tenant under its own prefix', () => {
    const ids = new SequentialIdGenerator('file');

    expect(new TenantFileKeys(ids, clock, scopeOf('clinic-7')).next('documents')).toBe(
      'tenants/clinic-7/documents/2026/03/file-1',
    );

    expect(new TenantFileKeys(ids, clock, scopeOf()).next('documents')).toBe('documents/2026/03/file-2');
  });

  it('never meets a tenant id that is not a key segment: the execution context refuses it first', () => {
    expect(() => scopeOf('a/b')).toThrow(InvalidTenantIdError);
    expect(() => scopeOf('hex.612f62')).toThrow(InvalidTenantIdError);
  });

  it('refuses an area that would make an invalid key, or one the purge would take for a staged file', () => {
    const keys = new TenantFileKeys(new SequentialIdGenerator('file'), clock);

    expect(() => keys.next('../outside')).toThrow(FileError);
    expect(() => keys.next('staging')).toThrow(FileError);
    expect(isFileKey('a'.repeat(1_025))).toBe(false);
  });
});
