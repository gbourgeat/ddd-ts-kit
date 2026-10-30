import { describe, expect, it } from 'vitest';
import { permissionSets } from '../src/check/authz/permission-sets';
import { classesOf } from '../src/check/declarations/classes-of';
import { DECLARATIONS_ENTRY } from '../src/check/declarations/declarations-entry';
import { refusedBeforeCommit } from '../src/check/domain-events/refused-before-commit';
import { listedCodes } from '../src/check/errors/listed-codes';
import { readStoredShape } from '../src/check/event-sourcing/read-stored-shape';
import { storedEventDeclarations } from '../src/check/event-sourcing/stored-event-declarations';
import { eventNameResolver } from '../src/check/events/event-name-resolver';
import { fileExports } from '../src/check/exports/file-exports';
import { shorthandStatusWrites } from '../src/check/lifecycle/shorthand-status-writes';
import type { SourceFile } from '../src/check/model/source-file';
import { withModuleRow } from '../src/check/modules/with-module-row';
import { nestEquivalentsOf } from '../src/check/nest/nest-equivalents-of';
import { classDeclaring } from '../src/check/ports/class-declaring';
import { loadProject } from '../src/check/project/load-project';
import { loadSourceFile } from '../src/check/project/load-source-file';
import { scan } from '../src/check/scan/scan';
import { classShapes } from '../src/check/schemas/class-shapes';
import { restoredCode } from '../src/check/schemas/restored-code';
import { drizzleUnscoped } from '../src/check/tenancy/drizzle-unscoped';
import { rawSqlText } from '../src/check/tenancy/raw-sql-text';
import { extendsValueObject } from '../src/check/values/extends-value-object';
import { parseConfig } from '../src/config';
import { DECLARATION_DECORATORS, DECORATOR_ENTRIES } from '../src/declared/declared-role';
import { projectWith } from './rules-support';

const CONFIG = parseConfig({ contexts: { billing: { classification: 'core' } } });
const BILLING = 'src/contexts/billing';
const CODEC = `${BILLING}/infrastructure/persistence/invoice-events.mapper.ts`;

const sourceAt = (file: string, text: string): SourceFile => loadSourceFile(CONFIG, file, text);

describe('the readers of the checker, on code written otherwise than the generator writes it', () => {
  it('reads no permission set whose context is not a string literal', () => {
    const code = "export const billingPermissions = definePermissions(CONTEXT, { 'invoice.issue': {} });";

    expect(permissionSets({ scan: scan(code) })).toEqual([]);
  });

  it('reads a stored event under a computed key by its class, and none whose spec is not an object literal', () => {
    const file = sourceAt(
      CODEC,
      [
        'const codecs = {',
        '  [InvoiceIssued.eventName]: defineStoredEvent(InvoiceIssued, { version: 1 }),',
        '  other: defineStoredEvent(Foo, spec),',
        '};',
      ].join('\n'),
    );

    expect(storedEventDeclarations(file).map(({ name, eventClass }) => [name, eventClass])).toEqual([
      [undefined, 'InvoiceIssued'],
    ]);
  });

  it('reads no shape of a type the file does not declare, and no name of an event class no file declares', () => {
    expect(readStoredShape(scan('export interface Other { a: string }'), 'Missing')).toBeUndefined();
    expect(eventNameResolver([])('Nope')).toBeUndefined();
  });

  it('reads an anonymous default export under the name default', () => {
    const file = sourceAt(`${BILLING}/domain/services/pricing.ts`, 'export default function () {}\n');

    expect(fileExports(file).map(({ name, kind }) => [name, kind])).toEqual([['default', 'function']]);
  });

  it('reads a class whose decorators end on a parenthesis nothing opens as undecorated', () => {
    const decorator = DECLARATION_DECORATORS.find((name) => DECORATOR_ENTRIES[name] === undefined) ?? '';
    const code = `import { ${decorator} } from '${DECLARATIONS_ENTRY}';\n)\nclass Foo {}\n`;

    expect(classesOf(scan(code)).map(({ name, decorations }) => [name, decorations])).toEqual([['Foo', []]]);
  });

  it('reads status written in an object literal, through the brackets of a call, and not outside any object', () => {
    const file = sourceAt(
      `${BILLING}/domain/aggregates/invoice.aggregate.ts`,
      'const next = { ...f(x), status };\nstatus }\n',
    );

    expect(shorthandStatusWrites(file)).toEqual([24]);
  });

  it('lists no code of a test file, and no shape of a class whose property carries no decorator', () => {
    const codes = sourceAt(`${BILLING}/test/unit/billing.codes.spec.ts`, 'export const BillingCodes = {};\n');

    const dto = sourceAt(
      `${BILLING}/presentation/http/invoices/issue-invoice.body.ts`,
      'export class Body {\n  name: string;\n}\n',
    );

    expect(listedCodes(codes)).toEqual([]);
    expect(classShapes(dto, restoredCode(dto))).toEqual([]);
  });
});

describe('the readers of the checker, on classes and adapters written otherwise than the generator writes them', () => {
  it('follows a class of the same file up to ValueObject', () => {
    const file = sourceAt(
      `${BILLING}/domain/value-objects/money.vo.ts`,
      [
        "import { ValueObject } from '@ddd-ts-kit/kernel';",
        'class Amount extends ValueObject<{ readonly cents: number }> {}',
        'export class Money extends Amount {}',
      ].join('\n'),
    );

    const money = file.structure.classes.find(({ name }) => name === 'Money');

    expect(money === undefined ? undefined : extendsValueObject(file, money, 'src/shared-kernel')).toBe(true);
  });

  it('reads the SQL of a raw call after the spaces of its argument list', () => {
    const file = sourceAt(`${BILLING}/infrastructure/persistence/knex-invoice.repository.ts`, "db.raw( 'select 1');\n");

    expect(rawSqlText(file, 7)).toBe('select 1');
  });

  it('cannot judge an executor held in a variable', () => {
    const file = sourceAt(
      `${BILLING}/infrastructure/persistence/drizzle-invoice.repository.ts`,
      'const db = this.database.executor();\n',
    );

    expect(drizzleUnscoped(file)).toEqual([
      {
        offset: 24,
        message:
          'The executor is used other than through a statement this rule can judge (held in a variable, a transaction).',
      },
    ]);
  });

  it('finds the class a file declares itself', () => {
    const path = `${BILLING}/domain/services/local.ts`;
    const project = loadProject(projectWith({ [path]: 'export class Local {}\n' }));
    const file = project.files.find((candidate) => candidate.path === path);

    expect(file === undefined ? undefined : classDeclaring(project, file, 'Local')?.name).toBe('Local');
  });

  it('reports the side effect import of the common package of Nest', () => {
    expect(nestEquivalentsOf('@nestjs/common', []).map(({ tool }) => tool)).toEqual(['its common package']);
  });

  it('refuses a Node built-in before the commit, and judges nothing outside the contexts and the platform', () => {
    const builtin = { name: 'fs', line: 1, target: { kind: 'builtin' as const, name: 'node:fs' } };

    const kernel = {
      name: 'Money',
      line: 2,
      target: {
        kind: 'file' as const,
        path: 'src/shared-kernel/money.ts',
        location: { area: 'shared-kernel' as const },
      },
    };

    expect(refusedBeforeCommit('billing', builtin)).toBe('which comes from node:fs');
    expect(refusedBeforeCommit('billing', kernel)).toBeUndefined();
  });

  it('writes the modules table under a Modules heading that has none yet', () => {
    const doc = withModuleRow('# Billing\n\n## Modules\n\nNone yet.\n', 'calendars', undefined);

    expect(doc).toBe(
      [
        '# Billing',
        '',
        '## Modules',
        '',
        '| Module | Purpose |',
        '|---|---|',
        '| `calendars` | TODO(domain): say in one sentence which concepts this module holds. |',
        '',
        'None yet.',
        '',
      ].join('\n'),
    );
  });
});
