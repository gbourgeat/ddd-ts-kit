import { describe, expect, it } from 'vitest';
import { strayEntry } from '../src/check/canonical/stray-entry';
import { moduleProblems } from '../src/check/configuration/module-problems';
import { runFixture } from '../src/check/fixtures/run-fixture';
import { SHARED_FOLDER_FIXTURES } from '../src/check/fixtures/shared-folder-fixtures';
import { isTestFile } from '../src/check/project/is-test-file';
import { loadProject } from '../src/check/project/load-project';
import { locate } from '../src/check/project/locate';
import { pathInContext } from '../src/check/support/path-in-context';
import { parseConfig } from '../src/config';
import { foldersOfContext, moduleNameFlaw, moduleSplit, roleFoldersOf, WITHOUT_MODULE } from '../src/model-modules';
import { Workspace } from '../src/workspace';
import { projectWith } from './rules-support';

const MODULES = ['calendars', 'waitlist'];
const SCHEDULING = 'src/contexts/scheduling';
const TREE = { directory: SCHEDULING, modules: MODULES };

const DIVIDED = parseConfig({
  contexts: {
    scheduling: { classification: 'core', modules: { calendars: {}, waitlist: {} } },
    billing: { classification: 'supporting' },
  },
});

describe('the split of a path of a context whose modules hold their tests, with a shared folder', () => {
  it('reads the test folder of a module as the test folder of the context, in that module', () => {
    expect(moduleSplit('calendars/test/builders/calendar.builder.ts', MODULES)).toEqual({
      module: 'calendars',
      path: 'test/builders/calendar.builder.ts',
    });

    expect(moduleSplit('waitlist/test/unit/join-waitlist.handler.spec.ts', MODULES)).toEqual({
      module: 'waitlist',
      path: 'test/unit/join-waitlist.handler.spec.ts',
    });

    expect(moduleSplit('calendars/test', MODULES)).toEqual({ module: 'calendars', path: 'test' });
  });

  it.each([
    ['shared/infrastructure/persistence/scheduling.schema.ts', 'infrastructure/persistence/scheduling.schema.ts'],
    ['shared/presentation/http/calendars.routes.ts', 'presentation/http/calendars.routes.ts'],
    ['shared/test/worlds/scheduling.world.ts', 'test/worlds/scheduling.world.ts'],
    ['shared/test', 'test'],
  ])('reads %s as a file of the context in no module, shared', (file, path) => {
    expect(moduleSplit(file, MODULES)).toEqual({ module: undefined, path, shared: true });
  });

  it.each(['shared', 'shared/domain/events/slot-freed.event.ts', 'shared/application/ports/clock.port.ts'])(
    'leaves %s as it is written: shared holds no domain and no application',
    (file) => {
      expect(moduleSplit(file, MODULES)).toEqual({ module: undefined, path: file });
    },
  );

  it('reads no shared folder in a context without modules, nor in a path already read without its module', () => {
    const file = 'shared/infrastructure/persistence/scheduling.schema.ts';

    expect(moduleSplit(file, WITHOUT_MODULE)).toEqual({ module: undefined, path: file });
  });

  it('still reads the specs of a module under the test folders of the context', () => {
    expect(moduleSplit('test/unit/calendars/calendar.aggregate.spec.ts', MODULES)).toEqual({
      module: 'calendars',
      path: 'test/unit/calendar.aggregate.spec.ts',
    });
  });
});

describe('the folders that hold files of a context', () => {
  it('are its modules and shared once it declares modules, and none before', () => {
    expect(foldersOfContext(MODULES)).toEqual(['calendars', 'waitlist', 'shared']);
    expect(foldersOfContext([])).toEqual([]);
  });

  it('lists a role folder of the test folder at the context, in each module and in shared', () => {
    const root = projectWith({
      [`${SCHEDULING}/test/builders/slot.builder.ts`]: '',
      [`${SCHEDULING}/calendars/test/builders/calendar.builder.ts`]: '',
      [`${SCHEDULING}/shared/test/builders/tenant.builder.ts`]: '',
    });

    expect(roleFoldersOf(new Workspace(root, false), TREE, 'test/builders')).toEqual([
      `${SCHEDULING}/test/builders`,
      `${SCHEDULING}/calendars/test/builders`,
      `${SCHEDULING}/shared/test/builders`,
    ]);
  });

  it('lists the specs of a module where the context keeps them and where the module does', () => {
    const root = projectWith({
      [`${SCHEDULING}/test/unit/calendars/calendar.aggregate.spec.ts`]: '',
      [`${SCHEDULING}/waitlist/test/unit/join-waitlist.handler.spec.ts`]: '',
    });

    expect(roleFoldersOf(new Workspace(root, false), TREE, 'test/unit')).toEqual([
      `${SCHEDULING}/test/unit`,
      `${SCHEDULING}/test/unit/calendars`,
      `${SCHEDULING}/waitlist/test/unit`,
    ]);
  });

  it('lists a role folder of a layer shared holds, and never a domain folder of shared', () => {
    const root = projectWith({
      [`${SCHEDULING}/shared/infrastructure/persistence/scheduling.schema.ts`]: '',
      [`${SCHEDULING}/calendars/infrastructure/persistence/calendar-row.schema.ts`]: '',
      [`${SCHEDULING}/shared/domain/events/slot-freed.event.ts`]: '',
    });

    const ws = new Workspace(root, false);

    expect(roleFoldersOf(ws, TREE, 'infrastructure/persistence')).toEqual([
      `${SCHEDULING}/infrastructure/persistence`,
      `${SCHEDULING}/calendars/infrastructure/persistence`,
      `${SCHEDULING}/shared/infrastructure/persistence`,
    ]);

    expect(roleFoldersOf(ws, TREE, 'domain/events')).toEqual([`${SCHEDULING}/domain/events`]);
  });

  it('lists no shared folder of a context that declares no module', () => {
    const root = projectWith({ [`${SCHEDULING}/shared/test/builders/tenant.builder.ts`]: '' });
    const tree = { directory: SCHEDULING, modules: [] };

    expect(roleFoldersOf(new Workspace(root, false), tree, 'test/builders')).toEqual([`${SCHEDULING}/test/builders`]);
  });
});

describe('the name shared, kept for the folder of what belongs to no module', () => {
  it('cannot name a module, while a name that holds the word stays a technical grouping', () => {
    expect(moduleNameFlaw('shared')).toEqual({ reason: 'shared-folder' });
    expect(moduleNameFlaw('shared-invoices')).toEqual({ reason: 'technical', word: 'shared' });
  });

  it('is refused by the config check, which says what the folder is for', () => {
    const { contexts } = parseConfig({ contexts: { billing: { classification: 'core', modules: { shared: {} } } } });

    const [problem, ...others] = Object.values(contexts).flatMap((billing) =>
      moduleProblems('billing', billing, { shared: {} }),
    );

    expect(others).toEqual([]);
    expect(problem?.needle).toBe('shared');
    expect(problem?.message).toBe('The module "shared" of "billing" takes the name of the folder shared/.');
    expect(problem?.fix).toContain('what belongs to none of its modules');
  });
});

describe('the location of a file of a module test folder and of the shared folder', () => {
  it('places a builder of a module in the test layer of that module, as a test file', () => {
    const file = `${SCHEDULING}/calendars/test/builders/calendar.builder.ts`;
    const location = locate(DIVIDED, file);

    expect(location).toEqual({
      area: 'context',
      context: 'scheduling',
      layer: 'test',
      inside: ['builders', 'calendar.builder.ts'],
      module: 'calendars',
    });

    expect(isTestFile(file, location)).toBe(true);
  });

  it('places the schema of the context in its infrastructure layer, shared, in no module', () => {
    const file = `${SCHEDULING}/shared/infrastructure/persistence/scheduling.schema.ts`;
    const location = locate(DIVIDED, file);

    expect(location).toEqual({
      area: 'context',
      context: 'scheduling',
      layer: 'infrastructure',
      inside: ['persistence', 'scheduling.schema.ts'],
      shared: true,
    });

    expect(isTestFile(file, location)).toBe(false);
  });

  it('places a world of shared in the test layer, as a test file', () => {
    const file = `${SCHEDULING}/shared/test/worlds/scheduling.world.ts`;
    const location = locate(DIVIDED, file);

    expect(location).toMatchObject({ layer: 'test', inside: ['worlds', 'scheduling.world.ts'], shared: true });
    expect(isTestFile(file, location)).toBe(true);
  });

  it('places nothing of shared in a layer it does not hold, nor in a context without modules', () => {
    expect(locate(DIVIDED, `${SCHEDULING}/shared/domain/events/slot-freed.event.ts`)).toEqual({
      area: 'context',
      context: 'scheduling',
      layer: 'root',
      inside: ['shared', 'domain', 'events', 'slot-freed.event.ts'],
    });

    expect(locate(DIVIDED, 'src/contexts/billing/shared/infrastructure/persistence/billing.schema.ts')).toMatchObject({
      layer: 'root',
      inside: ['shared', 'infrastructure', 'persistence', 'billing.schema.ts'],
    });
  });

  it('reads the path in the context of both without the folder that holds them', () => {
    const root = projectWith(
      {
        [`${SCHEDULING}/calendars/test/builders/calendar.builder.ts`]: 'export class CalendarBuilder {}\n',
        [`${SCHEDULING}/shared/presentation/http/calendars.routes.ts`]: 'export class CalendarsRoutes {}\n',
      },
      { contexts: { scheduling: { classification: 'core', modules: { calendars: {} } } } },
    );

    const project = loadProject(root);
    const paths = project.files.map((file) => pathInContext(project, file));

    expect(paths.toSorted()).toEqual(['presentation/http/calendars.routes.ts', 'test/builders/calendar.builder.ts']);
  });
});

const stray = (entry: string): string | undefined => strayEntry(`${SCHEDULING}/${entry}`, DIVIDED)?.message;

describe('the canonical tree of a context divided into modules', () => {
  it.each([
    'shared/',
    'shared/infrastructure/',
    'shared/infrastructure/persistence/',
    'shared/infrastructure/persistence/scheduling.schema.ts',
    'shared/presentation/',
    'shared/presentation/http/',
    'shared/presentation/http/calendars.routes.ts',
    'shared/presentation/http/guards/',
    'shared/presentation/http/guards/tenant.guard.ts',
    'shared/presentation/http/shared/',
    'shared/presentation/http/shared/money.schema.ts',
    'shared/test/',
    'shared/test/worlds/',
    'shared/test/worlds/scheduling.world.ts',
    'shared/test/fakes/',
    'shared/test/fakes/in-memory/clock.fake.ts',
    'shared/test/builders/',
    'shared/test/unit/',
    'shared/test/unit/tenant.guard.spec.ts',
    'shared/test/integration/',
    'shared/test/README.md',
    'calendars/test/',
    'calendars/test/unit/',
    'calendars/test/unit/domain/calendar.aggregate.spec.ts',
    'calendars/test/integration/',
    'calendars/test/builders/calendar.builder.ts',
    'calendars/test/fakes/calendar.repository.fake.ts',
    'test/unit/calendars/calendar.aggregate.spec.ts',
    'infrastructure/persistence/scheduling.schema.ts',
  ])('holds %s', (entry) => {
    expect(stray(entry)).toBeUndefined();
  });

  it.each([
    ['shared/domain/', '"shared/domain" is not a directory of shared/.'],
    ['shared/application/', '"shared/application" is not a directory of shared/.'],
    ['shared/infrastructure/external/', '"shared/infrastructure/external" is not a directory of shared/.'],
    ['shared/presentation/http/calendars/', '"shared/presentation/http/calendars" is not a directory of shared/.'],
    ['shared/helpers.ts', '"shared/helpers.ts" is not in a directory of shared/.'],
    ['shared/infrastructure/knex.ts', '"shared/infrastructure/knex.ts" is not in a directory of shared/.'],
    ['shared/test/setup.ts', '"shared/test/setup.ts" is not in a directory of shared/.'],
    ['shared/test/worlds/world.mjs', '"shared/test/worlds/world.mjs" is a source that is not a .ts file.'],
  ])('reports %s', (entry, message) => {
    expect(stray(entry)).toBe(message);
    expect(strayEntry(`${SCHEDULING}/${entry}`, DIVIDED)?.fix).not.toBe('');
  });
});

describe('what the config changes of the shared folder of a context', () => {
  it('opens shared to an extra directory of the config only when the config names it under shared/', () => {
    const config = parseConfig({
      contexts: {
        scheduling: {
          classification: 'core',
          modules: { calendars: {} },
          extraDirectories: ['infrastructure/external', 'shared/legacy'],
        },
      },
    });

    const flaw = (entry: string): string | undefined => strayEntry(`${SCHEDULING}/${entry}`, config)?.message;

    expect(flaw('shared/')).toBeUndefined();
    expect(flaw('shared/legacy/')).toBeUndefined();
    expect(flaw('shared/legacy/notes.ts')).toBeUndefined();
    expect(flaw('shared/infrastructure/external/')).toMatch(/^"shared\/infrastructure\/external" is not a directory/);
    expect(flaw('shared/domain/')).toBe('"shared/domain" is not a directory of shared/.');
  });

  it('holds no module file in shared, which is no module', () => {
    expect(stray('shared/calendars/calendars.module.ts')).toBe(
      '"shared/calendars/calendars.module.ts" is not in a directory of shared/.',
    );
  });

  it('holds the generated declarations of a layer of shared in the declared style, and in no other', () => {
    const declared = parseConfig({
      contexts: { scheduling: { classification: 'core', modules: { calendars: {} } } },
      stack: { style: 'declared' },
    });

    const generated = `${SCHEDULING}/shared/presentation/presentation.declarations.ts`;

    expect(strayEntry(generated, declared)).toBeUndefined();
    expect(strayEntry(generated, DIVIDED)).toBeDefined();
    expect(strayEntry(`${SCHEDULING}/shared/scheduling.declarations.ts`, declared)).toBeDefined();
  });

  it('keeps shared a stray folder in a context that declares no module', () => {
    expect(strayEntry('src/contexts/billing/shared/', DIVIDED)?.message).toBe(
      '"shared" is not a directory of the canonical tree.',
    );
  });
});

describe('the rules of the checker on the layout to come', () => {
  it.each(SHARED_FOLDER_FIXTURES.map((fixture) => [fixture.ruleId, fixture.name, fixture] as const))(
    '%s: %s',
    (_rule, _name, fixture) => {
      const outcome = runFixture(fixture);

      expect(outcome.ok ? '' : outcome.detail).toBe('');
    },
  );
});
