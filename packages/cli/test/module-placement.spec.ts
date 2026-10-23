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

  it('writes a spec with its subject, at the depth it was given, and leaves one already in a module alone', () => {
    const place = placement([]);

    expect(place(`${SCHEDULING}/test/unit/domain/slot.vo.spec.ts`, true)).toBe(
      `${SCHEDULING}/test/unit/calendars/domain/slot.vo.spec.ts`,
    );

    expect(place(`${SCHEDULING}/test/unit/waitlist/offer.vo.spec.ts`, true)).toBe(
      `${SCHEDULING}/test/unit/waitlist/offer.vo.spec.ts`,
    );

    expect(place(`${SCHEDULING}/test/unit/scheduling.permissions.spec.ts`, true)).toBe(
      `${SCHEDULING}/test/unit/scheduling.permissions.spec.ts`,
    );
  });
});
