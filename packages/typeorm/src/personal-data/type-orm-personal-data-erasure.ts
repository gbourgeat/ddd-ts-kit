import { Brackets, type EntityManager, type WhereExpressionBuilder } from 'typeorm';
import {
  ERASED_PERSONAL_DATA,
  NotADataSubjectIdError,
  NotNullablePersonalColumnError,
  isDataSubjectId,
  pseudonymisedValueOf,
  type PersonalDataErasure,
} from '@ddd-ts-kit/kernel';
import type { TypeOrmContext } from '../unit-of-work/type-orm-context';
import { aboutSubject } from './about-subject';
import { affectedRows } from './affected-rows';
import type { TypeOrmPersonalDataErasureOptions } from './type-orm-personal-data-erasure-options';
import type { TypeOrmPersonalFields } from './type-orm-personal-fields';

/** A personal property, its column as the database names it, and what it reads once pseudonymised. */
interface Pseudonymised {
  readonly property: string;
  readonly column: string;
  readonly erased: string | null;
}

/**
 * The erasure of a data subject from the entities a context declared with `personalFields`, on
 * TypeORM: the files the rows name are deleted from the storage first, then the rows of the subject
 * are deleted (`row`) or their personal columns pseudonymised (`pseudonymise`: a text reads
 * `ERASED_PERSONAL_DATA`, any other type nothing, a file column nothing). Every statement runs on
 * the entity manager of the unit of work and, for tenant data, in the tenant of the work alone. The
 * port of the context extends `PersonalDataErasure` and its adapter extends this class:
 * `class TypeOrmPatientErasure extends TypeOrmPersonalDataErasure implements PatientErasure`.
 */
export class TypeOrmPersonalDataErasure implements PersonalDataErasure {
  readonly name: string;

  constructor(
    private readonly context: TypeOrmContext,
    private readonly options: TypeOrmPersonalDataErasureOptions,
  ) {
    this.name = options.name;
    assertFilesReachable(options);
  }

  /** The rows reached in every declared entity, none the second time. A subject that is not an opaque id is refused before any statement. */
  async erase(subject: string): Promise<number> {
    if (!isDataSubjectId(subject)) {
      throw new NotADataSubjectIdError();
    }

    let reached = 0;

    for (const declaration of this.options.declarations) {
      reached += await this.eraseIn(declaration, subject);
    }

    return reached;
  }

  /** What a pseudonymisation would write is settled, and refused, before any file or row is touched. */
  private async eraseIn(declaration: TypeOrmPersonalFields, subject: string): Promise<number> {
    const manager = this.context.manager();
    const pseudonymised = declaration.erasure === 'row' ? undefined : pseudonymisedOf(manager, declaration);

    await this.deleteFilesOf(declaration, subject);

    return pseudonymised === undefined
      ? this.deleteRows(declaration, subject)
      : this.pseudonymise(declaration, subject, pseudonymised);
  }

  /** The content first, then the reference: a row that still names a deleted file is run again, a file nothing names is lost. */
  private async deleteFilesOf(declaration: TypeOrmPersonalFields, subject: string): Promise<void> {
    const storage = this.options.files;

    if (declaration.files.length === 0 || storage === undefined) {
      return;
    }

    const rows: readonly Readonly<Record<string, unknown>>[] = await this.context
      .manager()
      .getRepository(declaration.table)
      .find({
        select: Object.fromEntries(declaration.files.map((file) => [file, true])),
        where: aboutSubject(declaration, subject, this.options.tenant),
      });

    for (const row of rows) {
      for (const file of declaration.files) {
        const key = row[file];

        if (typeof key === 'string') {
          await storage.delete(key);
        }
      }
    }
  }

  private async deleteRows(declaration: TypeOrmPersonalFields, subject: string): Promise<number> {
    const deleted = await this.context
      .manager()
      .createQueryBuilder()
      .delete()
      .from(declaration.table)
      .where(aboutSubject(declaration, subject, this.options.tenant))
      .execute();

    return affectedRows(deleted);
  }

  private async pseudonymise(
    declaration: TypeOrmPersonalFields,
    subject: string,
    pseudonymised: readonly Pseudonymised[],
  ): Promise<number> {
    const manager = this.context.manager();
    const changes = Object.fromEntries(pseudonymised.map(({ property, erased }) => [property, erased]));

    const updated = await manager
      .createQueryBuilder()
      .update(declaration.table)
      .set(changes)
      .where(aboutSubject(declaration, subject, this.options.tenant))
      .andWhere(new Brackets((reached) => notYetErased(reached, pseudonymised, manager)))
      .execute();

    return affectedRows(updated);
  }
}

/** Each personal property with its column and what it reads afterwards, from the type the entity declares; a column that would read nothing has to accept null. */
function pseudonymisedOf(manager: EntityManager, declaration: TypeOrmPersonalFields): Pseudonymised[] {
  const metadata = manager.dataSource.getMetadata(declaration.table);

  const columnOf = (property: string) => {
    const column = metadata.findColumnWithPropertyName(property);

    if (column === undefined) {
      throw new Error(
        `The entity ${metadata.name} has no property "${property}": the declaration names one it does not have`,
      );
    }

    return column;
  };

  const pseudonymised = [
    ...declaration.fields.map((field) => {
      const { databaseName, type, isNullable } = columnOf(field);

      return { property: field, column: databaseName, erased: pseudonymisedValueOf(sqlTypeOf(type)), isNullable };
    }),
    ...declaration.files.map((file) => {
      const { databaseName, isNullable } = columnOf(file);

      return { property: file, column: databaseName, erased: null, isNullable };
    }),
  ];

  for (const { column, erased, isNullable } of pseudonymised) {
    if (erased === null && !isNullable) {
      throw new NotNullablePersonalColumnError(metadata.tableName, column);
    }
  }

  return pseudonymised;
}

/** The SQL type of a column as the entity declares it: a name, or a constructor (`String`, `Number`, `Date`) that stands for one. */
function sqlTypeOf(type: unknown): string {
  if (typeof type === 'string') {
    return type;
  }

  return type === String ? 'text' : 'other';
}

/** A row is reached while one personal column still holds something: a text other than the marker, any other value, a file. */
function notYetErased(
  reached: WhereExpressionBuilder,
  pseudonymised: readonly Pseudonymised[],
  manager: EntityManager,
): void {
  const { driver } = manager.dataSource;

  pseudonymised.forEach(({ column, erased }, index) => {
    const name = driver.escape(column);

    if (erased === null) {
      reached.orWhere(`${name} is not null`);
    } else {
      reached.orWhere(`(${name} is not null and ${name} <> :erased${String(index)})`, {
        [`erased${String(index)}`]: ERASED_PERSONAL_DATA,
      });
    }
  });
}

function assertFilesReachable({ declarations, files }: TypeOrmPersonalDataErasureOptions): void {
  const naming = declarations.find((declaration) => declaration.files.length > 0);

  if (naming !== undefined && files === undefined) {
    throw new Error(
      `The declaration of ${naming.table.options.name} names file columns (${naming.files.join(', ')}) and no file storage was given: the files of an erased person would stay in the storage`,
    );
  }
}
