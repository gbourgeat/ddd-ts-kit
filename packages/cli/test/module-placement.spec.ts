import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config';
import { modulePlacement } from '../src/model-modules';

const SCHEDULING = 'src/contexts/scheduling';

const CONFIG = parseConfig({
  contexts: { scheduling: { classification: 'core', modules: { calendars: {}, waitlist: {} } } },
});

/** The placement of a generator run in scheduling, the files of `existing` there, `--module` naming `asked`. */
function placement(existing: readonly string[], asked?: string) {
  const files = existing.map((file) => `${SCHEDULING}/${file}`);

  return modulePlacement({
    config: CONFIG,
    asked: asked === undefined ? undefined : { context: 'scheduling', module: asked },
    existsAsIs: (file) => files.some((existing) => existing === file || existing.startsWith(`${file}/`)),
    modulesOf: () => ['calendars', 'waitlist'],
    unplaced: (_context, relative) => {
      throw new Error(`unplaced ${relative}`);
    },
    split: (_context, relative, holder) => {
      throw new Error(`split ${relative} ${holder}`);
    },
    subjectModule: (_context, spec) => (spec.startsWith('slot.vo') ? 'calendars' : undefined),
  });
}

describe('where a generator writes a file in a context divided into modules', () => {
  it('writes a publisher in the module asked, whatever another module holds in its folder', () => {
    const place = placement(['calendars/application/integration/publishers/calendar-created.publisher.ts'], 'waitlist');

    expect(place(`${SCHEDULING}/application/integration/publishers/waitlist-joined.publisher.ts`, true)).toBe(
      `${SCHEDULING}/waitlist/application/integration/publishers/waitlist-joined.publisher.ts`,
    );
  });

  it('refuses a publisher without --module: a folder of a role is no use case', () => {
    const place = placement(['calendars/application/integration/publishers/calendar-created.publisher.ts']);

    expect(() => place(`${SCHEDULING}/application/integration/publishers/waitlist-joined.publisher.ts`, true)).toThrow(
      'unplaced application/integration/publishers/waitlist-joined.publisher.ts',
    );
  });

  it('writes a controller with its use case, and refuses a --module that would split them', () => {
    const existing = ['waitlist/application/commands/offer-freed-slot/offer-freed-slot.command.ts'];
    const controller = `${SCHEDULING}/presentation/http/calendars/offer-freed-slot/offer-freed-slot.controller.ts`;

    expect(placement(existing)(controller, true)).toBe(
      `${SCHEDULING}/waitlist/presentation/http/calendars/offer-freed-slot/offer-freed-slot.controller.ts`,
    );

    expect(() => placement(existing, 'calendars')(controller, true)).toThrow('split');
  });

  it('writes a spec in the test folder of the module of its subject, at the depth it was given, and one of no module in shared', () => {
    const place = placement([]);

    expect(place(`${SCHEDULING}/test/unit/domain/slot.vo.spec.ts`, true)).toBe(
      `${SCHEDULING}/calendars/test/unit/domain/slot.vo.spec.ts`,
    );

    expect(place(`${SCHEDULING}/waitlist/test/unit/offer.vo.spec.ts`, true)).toBe(
      `${SCHEDULING}/waitlist/test/unit/offer.vo.spec.ts`,
    );

    expect(place(`${SCHEDULING}/test/unit/scheduling.permissions.spec.ts`, true)).toBe(
      `${SCHEDULING}/shared/test/unit/scheduling.permissions.spec.ts`,
    );
  });

  it('writes a fake and a builder in the test folder of the asked module, of the one that holds them, else in shared', () => {
    const fake = `${SCHEDULING}/test/fakes/mailer.fake.ts`;
    const builder = `${SCHEDULING}/test/builders/offer.builder.ts`;

    expect(placement([], 'waitlist')(fake, true)).toBe(`${SCHEDULING}/waitlist/test/fakes/mailer.fake.ts`);

    expect(placement(['calendars/test/fakes/mailer.fake.ts'], 'waitlist')(fake, false)).toBe(
      `${SCHEDULING}/calendars/test/fakes/mailer.fake.ts`,
    );

    expect(placement([])(builder, true)).toBe(`${SCHEDULING}/shared/test/builders/offer.builder.ts`);
  });

  it('writes what belongs to no module in shared, and reads it at the level of a context that has not moved it yet', () => {
    const schema = `${SCHEDULING}/infrastructure/persistence/scheduling.schema.ts`;

    expect(placement([], 'calendars')(schema, true)).toBe(
      `${SCHEDULING}/shared/infrastructure/persistence/scheduling.schema.ts`,
    );

    expect(placement([])(`${SCHEDULING}/presentation/http/calendars.routes.ts`, true)).toBe(
      `${SCHEDULING}/shared/presentation/http/calendars.routes.ts`,
    );

    expect(placement([])(`${SCHEDULING}/test/worlds/scheduling.world.ts`, true)).toBe(
      `${SCHEDULING}/shared/test/worlds/scheduling.world.ts`,
    );

    expect(placement(['infrastructure/persistence/scheduling.schema.ts'])(schema, false)).toBe(schema);
    expect(placement([])(`${SCHEDULING}/scheduling.codes.ts`, true)).toBe(`${SCHEDULING}/scheduling.codes.ts`);
    expect(placement([])(`${SCHEDULING}/domain/errors/codes.ts`, true)).toBe(`${SCHEDULING}/domain/errors/codes.ts`);
  });

  it('leaves a path of a context that declares no module as it is written', () => {
    const place = modulePlacement({
      config: CONFIG,
      asked: undefined,
      existsAsIs: () => false,
      modulesOf: () => [],
      unplaced: (_context, relative) => {
        throw new Error(`unplaced ${relative}`);
      },
      split: (_context, relative) => {
        throw new Error(`split ${relative}`);
      },
      subjectModule: () => undefined,
    });

    expect(place('src/contexts/billing/test/fakes/clock.fake.ts', true)).toBe(
      'src/contexts/billing/test/fakes/clock.fake.ts',
    );

    expect(place('src/contexts/billing/domain/events/paid.event.ts', true)).toBe(
      'src/contexts/billing/domain/events/paid.event.ts',
    );
  });
});
