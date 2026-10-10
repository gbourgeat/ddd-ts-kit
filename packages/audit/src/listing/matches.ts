import type { AuditEntry, AuditFilter } from '@ddd-ts-kit/kernel';

type EntryTest = (entry: AuditEntry) => boolean;

export function matches(filter: AuditFilter): EntryTest {
  const tests = [...identityTests(filter), ...resourceTests(filter), ...rangeTests(filter)];

  return (entry) => tests.every((test) => test(entry));
}

function identityTests(filter: AuditFilter): EntryTest[] {
  const expected: readonly (readonly [string | undefined, (entry: AuditEntry) => string | undefined])[] = [
    [filter.chain, (entry) => entry.chain],
    [filter.tenantId, (entry) => entry.tenantId],
    [filter.actorId, (entry) => entry.actor.id],
    [filter.action, (entry) => entry.action],
    [filter.category, (entry) => entry.category],
    [filter.outcome, (entry) => entry.outcome],
    [filter.correlationId, (entry) => entry.correlationId],
  ];

  return expected.flatMap(([value, read]) => (value === undefined ? [] : [(entry: AuditEntry) => read(entry) === value]));
}

function resourceTests({ resource }: AuditFilter): EntryTest[] {
  if (resource === undefined) return [];

  return [(entry) => entry.resource?.type === resource.type && (resource.id === undefined || entry.resource.id === resource.id)];
}

function rangeTests(filter: AuditFilter): EntryTest[] {
  const { from, to, fromSequence, toSequence } = filter;

  return [
    ...(from === undefined ? [] : [(entry: AuditEntry) => entry.occurredAt.getTime() >= from.getTime()]),
    ...(to === undefined ? [] : [(entry: AuditEntry) => entry.occurredAt.getTime() < to.getTime()]),
    ...(fromSequence === undefined ? [] : [(entry: AuditEntry) => entry.sequence >= fromSequence]),
    ...(toSequence === undefined ? [] : [(entry: AuditEntry) => entry.sequence <= toSequence]),
  ];
}
