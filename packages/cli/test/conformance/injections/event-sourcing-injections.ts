import type { Injection } from '../injection.js';
import { PATHS } from '../paths.js';
import { SOURCE_ALIAS } from '../source-alias.js';
import { SOURCE_SUFFIX } from '../source-suffix.js';

const { SCHEDULING } = PATHS;
const ALIAS = `${SOURCE_ALIAS}contexts/scheduling`;
const RECORD = `${SCHEDULING}/domain/aggregates/attendance-record.aggregate.ts`;
const CODEC = `${SCHEDULING}/infrastructure/persistence/attendance-record-events.mapper.ts`;
const NOTE_NO_SHOW = `${SCHEDULING}/application/commands/note-no-show/note-no-show.handler.ts`;
const HISTORY = `${SCHEDULING}/application/projections/attendance-history.projection.ts`;
const CREATED = 'AttendanceRecordCreated';
const RENAMED = 'OpenAttendanceRecord';

const STALE =
  'The generated list of a class is read from its constructor: a changed signature leaves the barrel stale until it is regenerated.';

/** The rules of the event-sourced attendance record of scheduling, the one aggregate of the example kept as a stream. */
export const EVENT_SOURCING_INJECTIONS: readonly Injection[] = [
  {
    rule: 'event-sourcing/state-in-apply',
    what: 'an event-sourced aggregate that writes its state outside an apply method',
    file: RECORD,
    changes: [
      {
        file: RECORD,
        from: '  toState(): AttendanceRecordState {\n',
        to: '  toState(): AttendanceRecordState {\n    this.state = { ...this.state };\n\n',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/event-sourcing-state-in-apply',
  },
  {
    rule: 'event-sourcing/past-tense',
    what: 'an event of an event-sourced aggregate named as a command',
    file: RECORD,
    changes: [
      { file: RECORD, from: `import { ${CREATED} }`, to: `import { ${CREATED} as ${RENAMED} }` },
      { file: RECORD, from: `  | ${CREATED}\n`, to: `  | ${RENAMED}\n` },
      { file: RECORD, from: `new ${CREATED}(`, to: `new ${RENAMED}(` },
      { file: RECORD, from: `(event: ${CREATED})`, to: `(event: ${RENAMED})` },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/event-sourcing-past-tense',
  },
  {
    rule: 'event-sourcing/store-behind-repository',
    what: 'a command handler given the event store',
    file: NOTE_NO_SHOW,
    changes: [
      { file: NOTE_NO_SHOW, from: 'import type { Clock }', to: 'import type { Clock, EventStore }' },
      {
        file: NOTE_NO_SHOW,
        from: '    private readonly clock: Clock,\n',
        to: '    private readonly clock: Clock,\n    private readonly store: EventStore,\n',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/event-sourcing-store-behind-repository',
    alsoReports: [{ tool: 'checker', rule: 'declarations/barrel-current', reason: STALE }],
  },
  {
    rule: 'event-sourcing/projection-never-appends',
    what: 'a projection given the repository of the aggregate whose events it applies',
    file: HISTORY,
    changes: [
      {
        file: HISTORY,
        where: 'start',
        to: `import type { AttendanceRecordRepository } from '${ALIAS}/domain/repositories/attendance-record.repository${SOURCE_SUFFIX}';\n`,
      },
      {
        file: HISTORY,
        from: '  constructor(private readonly history: AttendanceHistory) {}',
        to: '  constructor(\n    private readonly history: AttendanceHistory,\n    private readonly records: AttendanceRecordRepository,\n  ) {}',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/event-sourcing-projection-never-appends',
    alsoReports: [{ tool: 'checker', rule: 'declarations/barrel-current', reason: STALE }],
  },
  {
    rule: 'event-sourcing/upcaster-required',
    what: 'a stored event raised to version 2 without the upcaster from version 1',
    file: CODEC,
    changes: [
      {
        file: CODEC,
        from: "'scheduling.attendance-record.no-show-noted': defineStoredEvent(AttendanceRecordNoShowNoted, {\n    version: 1,",
        to: "'scheduling.attendance-record.no-show-noted': defineStoredEvent(AttendanceRecordNoShowNoted, {\n    version: 2,",
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/event-sourcing-upcaster-required',
  },
];
