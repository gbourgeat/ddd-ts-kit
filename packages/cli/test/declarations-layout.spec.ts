import { describe, expect, it } from 'vitest';
import {
  declarationsFolderOf,
  contextDeclarations,
  earlierLayoutOf,
  folderDeclarationsFile,
  isDeclarationsFile,
  renderDeclarations,
} from '../src/declared';

describe('the folder whose declarations hold a role file', () => {
  it('is its layer, whatever the role folder, the use case or the route below it', () => {
    expect(declarationsFolderOf('application/commands/book-appointment/book-appointment.handler.ts', [])).toBe(
      'application',
    );

    expect(declarationsFolderOf('application/integration/publishers/appointment-booked.publisher.ts', [])).toBe(
      'application',
    );

    expect(
      declarationsFolderOf('presentation/http/appointments/book-appointment/book-appointment.controller.ts', []),
    ).toBe('presentation');

    expect(declarationsFolderOf('infrastructure/practitioner-directory.gateway.ts', [])).toBe('infrastructure');
  });

  it('is the folder at <layer>/<folder>/ when grouped by role folder, as 0.85 and 0.86 wrote them', () => {
    const handler = 'application/commands/book-appointment/book-appointment.handler.ts';

    expect(declarationsFolderOf(handler, [], 'role-folder')).toBe('application/commands');

    expect(declarationsFolderOf('infrastructure/persistence/knex.repository.ts', [], 'role-folder')).toBe(
      'infrastructure/persistence',
    );

    expect(declarationsFolderOf('infrastructure/practitioner-directory.gateway.ts', [], 'role-folder')).toBe(
      'infrastructure',
    );
  });

  it('is the layer in the module of the model the config declares, and no folder of one it does not', () => {
    const inModule = 'application/waitlist/commands/join-waitlist/join-waitlist.handler.ts';

    expect(declarationsFolderOf(inModule, ['waitlist'])).toBe('application/waitlist');
    expect(declarationsFolderOf(inModule, ['waitlist'], 'role-folder')).toBe('application/waitlist/commands');
    expect(declarationsFolderOf(inModule, [])).toBe('application');

    expect(isDeclarationsFile('scheduling', 'application/waitlist/application.declarations.ts', ['waitlist'])).toBe(
      true,
    );

    expect(isDeclarationsFile('scheduling', 'application/waitlist/waitlist.declarations.ts', ['waitlist'])).toBe(false);

    expect(folderDeclarationsFile('application/waitlist', 'application')).toBe(
      'application/waitlist/application.declarations.ts',
    );

    expect(folderDeclarationsFile('infrastructure')).toBe('infrastructure/infrastructure.declarations.ts');
    expect(folderDeclarationsFile('application/queries')).toBe('application/queries/queries.declarations.ts');
  });
});

describe('a generated declarations file, told from the others', () => {
  it('is the summary at the root of the context, the file named after its layer, or one named after a role folder', () => {
    expect(isDeclarationsFile('scheduling', 'scheduling.declarations.ts', [])).toBe(true);
    expect(isDeclarationsFile('scheduling', 'application/application.declarations.ts', [])).toBe(true);
    expect(isDeclarationsFile('scheduling', 'presentation/presentation.declarations.ts', [])).toBe(true);
    expect(isDeclarationsFile('scheduling', 'application/commands/commands.declarations.ts', [])).toBe(true);
    expect(isDeclarationsFile('scheduling', 'presentation/http/http.declarations.ts', [])).toBe(true);
    expect(isDeclarationsFile('scheduling', 'infrastructure/infrastructure.declarations.ts', [])).toBe(true);
  });

  it('is not a file named otherwise, deeper than a role folder, or in a layer that holds no role file', () => {
    expect(isDeclarationsFile('scheduling', 'billing.declarations.ts', [])).toBe(false);
    expect(isDeclarationsFile('scheduling', 'application/commands/queries.declarations.ts', [])).toBe(false);
    expect(isDeclarationsFile('scheduling', 'application/commands/book/book.declarations.ts', [])).toBe(false);
    expect(isDeclarationsFile('scheduling', 'domain/events/events.declarations.ts', [])).toBe(false);
    expect(isDeclarationsFile('scheduling', 'application/application.declarations.spec.ts', [])).toBe(false);
    expect(isDeclarationsFile('scheduling', 'application/commands/commands.declarations.spec.ts', [])).toBe(false);
  });
});

describe('the declarations of a context', () => {
  it('are one file per layer, holding its own registrations, and a summary that only re-exports them', () => {
    const files = [
      'CONTEXT.md',
      'application/commands/book-appointment/book-appointment.command.ts',
      'application/commands/book-appointment/book-appointment.handler.ts',
      'application/queries/get-appointment/get-appointment.handler.ts',
      'infrastructure/practitioner-directory.gateway.ts',
      'domain/aggregates/appointment.aggregate.ts',
    ];

    const asked: string[][] = [];

    const rendered = renderDeclarations({
      context: 'scheduling',
      files,
      modules: [],
      specifierOf: (file) => `@/contexts/scheduling/${file.replace(/\.ts$/, '')}`,
      injectedIn: (roleFiles) => {
        asked.push([...roleFiles]);

        return roleFiles.some((file) => file.endsWith('book-appointment.handler.ts'))
          ? {
              imports: ["import { injected } from '@ddd-ts-kit/kernel/declarations';"],
              calls: ['injected(Book, [Clock]);'],
            }
          : { imports: [], calls: [] };
      },
    });

    expect([...rendered.keys()]).toEqual([
      'application/application.declarations.ts',
      'infrastructure/infrastructure.declarations.ts',
      'scheduling.declarations.ts',
    ]);

    expect(asked).toEqual([
      [
        'application/commands/book-appointment/book-appointment.command.ts',
        'application/commands/book-appointment/book-appointment.handler.ts',
        'application/queries/get-appointment/get-appointment.handler.ts',
      ],
      ['infrastructure/practitioner-directory.gateway.ts'],
    ]);

    expect(rendered.get('application/application.declarations.ts')).toBe(
      [
        "import { injected } from '@ddd-ts-kit/kernel/declarations';",
        '',
        "export * from '@/contexts/scheduling/application/commands/book-appointment/book-appointment.command';",
        "export * from '@/contexts/scheduling/application/commands/book-appointment/book-appointment.handler';",
        "export * from '@/contexts/scheduling/application/queries/get-appointment/get-appointment.handler';",
        '',
        'injected(Book, [Clock]);',
        '',
      ].join('\n'),
    );

    expect(rendered.get('scheduling.declarations.ts')).toBe(
      [
        "export * from '@/contexts/scheduling/application/application.declarations';",
        "export * from '@/contexts/scheduling/infrastructure/infrastructure.declarations';",
        '',
      ].join('\n'),
    );
  });
});

describe('an earlier layout of the declarations', () => {
  const declared = (entries: readonly string[]) => ({
    context: 'scheduling',
    directory: 'src/contexts/scheduling',
    entries,
    sources: () => undefined,
    modules: [],
    specifierOf: (file: string) => `@/${file.replace(/\.ts$/, '')}`,
  });

  const written = (files: ReadonlyMap<string, string>) => (entry: string) => files.get(entry);

  it('is the files of the role folders that 0.85 and 0.86 wrote, while they are current', () => {
    const context = declared(['application/commands/book/book.handler.ts']);
    const { files } = contextDeclarations(context, 'role-folder');

    expect(earlierLayoutOf(context, written(files))).toBe('role-folders');
  });

  it('is none for a context whose role files sit directly in their layer: both layouts write the same files', () => {
    const context = declared(['infrastructure/practitioner-directory.gateway.ts']);
    const { files } = contextDeclarations(context);

    expect(earlierLayoutOf(context, written(files))).toBeUndefined();
  });
});
