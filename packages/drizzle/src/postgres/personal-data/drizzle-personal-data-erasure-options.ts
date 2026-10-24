import type { ExecutionScope, FileStorage } from '@ddd-ts-kit/kernel';
import type { DrizzlePersonalFields } from './drizzle-personal-fields';

export interface DrizzleErasureTenant {
  readonly scope: ExecutionScope;
  /** The SQL name of the tenant column every declared table has. Default `tenant_id`. */
  readonly column?: string;
}

export interface DrizzlePersonalDataErasureOptions {
  /** The copy this erasure reaches, as the report of `eraseDataSubject` names it: `identity.persons`. */
  readonly name: string;
  /** The tables of the context that hold personal data, each with its `personalFields` declaration. */
  readonly declarations: readonly DrizzlePersonalFields[];
  /** For tables of tenant data: every statement is confined to the tenant of the work in progress, and never widened by an elevation. Absent: the tables hold the rows of every tenant, or the project has none. */
  readonly tenant?: DrizzleErasureTenant;
  /** Where the files the declarations name live: deleted before their columns are emptied. Required as soon as a declaration names a file column. */
  readonly files?: FileStorage;
}
