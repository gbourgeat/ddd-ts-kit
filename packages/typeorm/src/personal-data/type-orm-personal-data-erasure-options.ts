import type { ExecutionScope, FileStorage } from '@ddd-ts-kit/kernel';
import type { TypeOrmPersonalFields } from './type-orm-personal-fields';

export interface TypeOrmErasureTenant {
  readonly scope: ExecutionScope;
  /** The property that holds the tenant in every declared entity. Default `tenantId`. */
  readonly property?: string;
}

export interface TypeOrmPersonalDataErasureOptions {
  /** The copy this erasure reaches, as the report of `eraseDataSubject` names it: `identity.persons`. */
  readonly name: string;
  /** The entities of the context that hold personal data, each with its `personalFields` declaration. */
  readonly declarations: readonly TypeOrmPersonalFields[];
  /** For entities of tenant data: every statement is confined to the tenant of the work in progress, and never widened by an elevation. Absent: the tables hold the rows of every tenant, or the project has none. */
  readonly tenant?: TypeOrmErasureTenant;
  /** Where the files the declarations name live: deleted before their columns are emptied. Required as soon as a declaration names a file column. */
  readonly files?: FileStorage;
}
