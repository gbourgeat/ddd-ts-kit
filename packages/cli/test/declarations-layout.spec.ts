import { describe, expect, it } from 'vitest';
import {
  declarationsFolderOf,
  folderDeclarationsFile,
  isDeclarationsFile,
  renderDeclarations,
} from '../src/declared/index.js';

describe('the role folder a role file rolls up to', () => {
  it('is the folder at <layer>/<folder>/, whatever the use case or the route below it', () => {
    expect(declarationsFolderOf('application/commands/book-appointment/book-appointment.handler.ts')).toBe(
      'application/commands',
    );

    expect(declarationsFolderOf('application/integration/publishers/appointment-booked.publisher.ts')).toBe(
      'application/integration',
    );

    expect(declarationsFolderOf('presentation/http/appointments/book-appointment/book-appointment.controller.ts')).toBe(
      'presentation/http',
    );

    expect(declarationsFolderOf('infrastructure/persistence/knex-appointment.repository.ts')).toBe(
      'infrastructure/persistence',
    );
  });

  it('is the layer for a role file sitting directly in it, and its declarations are named after it', () => {
    expect(declarationsFolderOf('infrastructure/practitioner-directory.gateway.ts')).toBe('infrastructure');
    expect(folderDeclarationsFile('infrastructure')).toBe('infrastructure/infrastructure.declarations.ts');
    expect(folderDeclarationsFile('application/queries')).toBe('application/queries/queries.declarations.ts');
  });
});

describe('a generated declarations file, told from the others', () => {
  it('is the summary at the root of the context, or the file named after its role folder', () => {
    expect(isDeclarationsFile('scheduling', 'scheduling.declarations.ts')).toBe(true);
    expect(isDeclarationsFile('scheduling', 'application/commands/commands.declarations.ts')).toBe(true);
    expect(isDeclarationsFile('scheduling', 'presentation/http/http.declarations.ts')).toBe(true);
    expect(isDeclarationsFile('scheduling', 'infrastructure/infrastructure.declarations.ts')).toBe(true);
  });

  it('is not a file named otherwise, deeper than a role folder, or in a layer that holds no role file', () => {
    expect(isDeclarationsFile('scheduling', 'billing.declarations.ts')).toBe(false);
    expect(isDeclarationsFile('scheduling', 'application/commands/queries.declarations.ts')).toBe(false);
    expect(isDeclarationsFile('scheduling', 'application/commands/book/book.declarations.ts')).toBe(false);
    expect(isDeclarationsFile('scheduling', 'domain/events/events.declarations.ts')).toBe(false);
    expect(isDeclarationsFile('scheduling', 'application/commands/commands.declarations.spec.ts')).toBe(false);
  });
});

describe('the declarations of a context', () => {
  it('are one file per role folder, holding its own registrations, and a summary that only re-exports them', () => {
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
      'application/commands/commands.declarations.ts',
      'application/queries/queries.declarations.ts',
      'infrastructure/infrastructure.declarations.ts',
      'scheduling.declarations.ts',
    ]);

    expect(asked).toEqual([
      [
        'application/commands/book-appointment/book-appointment.command.ts',
        'application/commands/book-appointment/book-appointment.handler.ts',
      ],
      ['application/queries/get-appointment/get-appointment.handler.ts'],
      ['infrastructure/practitioner-directory.gateway.ts'],
    ]);

    expect(rendered.get('application/commands/commands.declarations.ts')).toBe(
      [
        "import { injected } from '@ddd-ts-kit/kernel/declarations';",
        '',
        "export * from '@/contexts/scheduling/application/commands/book-appointment/book-appointment.command';",
        "export * from '@/contexts/scheduling/application/commands/book-appointment/book-appointment.handler';",
        '',
        'injected(Book, [Clock]);',
        '',
      ].join('\n'),
    );

    expect(rendered.get('scheduling.declarations.ts')).toBe(
      [
        "export * from '@/contexts/scheduling/application/commands/commands.declarations';",
        "export * from '@/contexts/scheduling/application/queries/queries.declarations';",
        "export * from '@/contexts/scheduling/infrastructure/infrastructure.declarations';",
        '',
      ].join('\n'),
    );
  });
});
