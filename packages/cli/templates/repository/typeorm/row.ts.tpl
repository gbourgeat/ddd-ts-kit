import type { AuditStamp } from '@ddd-ts-kit/kernel';

export interface {{aggregate.pascal}}Columns {
  id: string;
  registeredAt: Date;
  // TODO(domain): add one field per field of {{aggregate.pascal}}State, as the entity schema of {{context.kebab}}.schema.ts declares it.
}

export interface {{aggregate.pascal}}Row extends {{aggregate.pascal}}Columns, AuditStamp {
  version: number;
}
