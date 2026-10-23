import type { Injection } from '../injection';
import { PATHS } from '../paths';
import { SOURCE_ALIAS } from '../source-alias';
import { SOURCE_SUFFIX } from '../source-suffix';

const { CONFIG, SCHEDULING } = PATHS;
const SCHEDULING_DOC = `${SCHEDULING}/CONTEXT.md`;

const WAITLIST_ROW =
  '| `waitlist` | The waitlist of a calendar for one day: its waiters, and the offers of a freed slot made to them. |';

const DAY_RESULT = `${SCHEDULING}/application/calendars/queries/get-calendar-day/get-calendar-day.result.ts`;
const STATUS_IMPORT = `import type { AppointmentStatus } from '${SOURCE_ALIAS}contexts/scheduling/domain/calendars/vocabularies/appointment-status.vocabulary${SOURCE_SUFFIX}';`;
const WAITER_IMPORT = `import type { Waiter } from '${SOURCE_ALIAS}contexts/scheduling/domain/waitlist/value-objects/waiter.vo${SOURCE_SUFFIX}';`;

/** The modules of the model of scheduling: declared in the language, complete, and acyclic. */
export const MODULE_INJECTIONS: readonly Injection[] = [
  {
    rule: 'module/declared',
    what: 'a module named after a technical grouping, its row written all the same',
    file: CONFIG,
    changes: [
      { file: CONFIG, from: '"waitlist": {}', to: '"waitlist": {},\n        "shared": {}' },
      {
        file: SCHEDULING_DOC,
        from: WAITLIST_ROW,
        to: `${WAITLIST_ROW}\n| \`shared\` | What several modules reach for. |`,
      },
    ],
    checker: true,
  },
  {
    rule: 'module/complete',
    what: 'a port left at the level of a context divided into modules',
    file: `${SCHEDULING}/application/ports`,
    changes: [
      {
        file: `${SCHEDULING}/application/ports/slot-offer.port.ts`,
        to: '/** Offers a freed slot to whoever waits for one. */\nexport abstract class SlotOffer {\n  abstract offer(slotId: string): Promise<void>;\n}\n',
      },
    ],
    checker: true,
  },
  {
    rule: 'module/no-cycle',
    what: 'a view of the calendars that reads a waiter, while the waitlist reads the calendars',
    file: DAY_RESULT,
    changes: [
      { file: DAY_RESULT, from: STATUS_IMPORT, to: `${STATUS_IMPORT}\n${WAITER_IMPORT}` },
      {
        file: DAY_RESULT,
        from: '  readonly calendarId: string;\n  readonly day: string;',
        to: '  readonly calendarId: string;\n  readonly day: string;\n  /** The waiters of the day, for a calendar with a waitlist. */\n  readonly waiters?: readonly Waiter[];',
      },
    ],
    checker: true,
  },
];
