import type { RuleDoc } from '../model/rule-doc.js';

export const EVENT_SOURCING_DOCS: Readonly<Record<string, RuleDoc>> = {
  'event-sourcing/state-in-apply': {
    why: 'An event-sourced aggregate is rebuilt by replaying its events through its apply methods, so the state a command leaves must be exactly what those methods make of the events it recorded. A command that also writes the state directly produces a state no replay will ever rebuild: the aggregate behaves one way just after the command and another way once loaded. Judged: every class of domain/aggregates/ that extends EventSourcedAggregate; outside the constructor, the static methods and the apply methods (a method named apply followed by an upper-case letter, and restore, which takes the state of a snapshot), an assignment, an increment or a mutating call (push, splice, set, add, delete...) on something of this is reported, and so is this.record(..) inside an apply method, which would record the event again at each replay.',
    bad: `// domain/aggregates/attendance-record.aggregate.ts
noteNoShow(appointmentId: string, now: Date): void {
  this.state = { noShows: this.state.noShows + 1 }; // written twice: here and by the replay
  this.record(new NoShowNoted(this.id, now, appointmentId));
}`,
    good: `// domain/aggregates/attendance-record.aggregate.ts
noteNoShow(appointmentId: string, now: Date): void {
  this.record(new NoShowNoted(this.id, now, appointmentId));
}

private applyNoShowNoted(event: NoShowNoted): void {
  this.state = { noShows: this.state.noShows + 1 };
}`,
  },
  'event-sourcing/past-tense': {
    why: 'A stored event is a fact that is kept and replayed for as long as the aggregate lives, read by people and by projections that were not written yet. A name in the present or the imperative (BookAppointment, Cancel) reads as a request that may still be refused; a name in the past tense says it happened. Judged: in a file of domain/aggregates/ holding a class that extends EventSourcedAggregate, every name imported from domain/events/: one word of it must read as a past participle (ending in -ed, or a common irregular one such as paid, held, taken, withdrawn, sent, set, made, done, lost, won: the words generate domain-event accepts).',
    bad: `// domain/aggregates/attendance-record.aggregate.ts
import { NoteNoShow } from '@/contexts/scheduling/domain/events/note-no-show.event';`,
    good: `// domain/aggregates/attendance-record.aggregate.ts
import { NoShowNoted } from '@/contexts/scheduling/domain/events/no-show-noted.event';`,
  },
  'event-sourcing/store-behind-repository': {
    why: "The domain and the use cases see an event-sourced aggregate exactly as they see any other: loaded by its repository port, changed by its methods, saved by the same port. A handler that reads a stream itself decides how events become state, which is the aggregate's job, and binds the use case to a storage technique the next aggregate may not use. Judged: production files of domain/ and application/ of a context; importing EventStore, SnapshotStore, CheckpointStore, EventSourcedRepository, EventSerializer, CatchUpSubscription or InMemoryEventStore from @ddd-ts-kit/kernel is reported. Infrastructure, the module file and the platform are left alone.",
    bad: `// application/commands/note-no-show/note-no-show.handler.ts
constructor(private readonly store: EventStore) {}
const events = await this.store.readStream(\`scheduling.attendance-record-\${command.patientId}\`);`,
    good: `// application/commands/note-no-show/note-no-show.handler.ts
constructor(private readonly records: AttendanceRecordRepository) {}
const record = await this.records.findById(command.patientId);`,
  },
  'event-sourcing/projection-never-appends': {
    why: 'A projection turns facts into a read model; it is replayed from position zero whenever its read model is rebuilt. A projection that appends to a stream would append again at every rebuild, and makes the read side decide facts. Judged: production files of application/projections/ and any file declaring a class with @Projection; naming EventStore or EventSourcedRepository of @ddd-ts-kit/kernel, or anything imported from domain/repositories/, is reported.',
    bad: `// application/projections/attendance-history.projection.ts
constructor(private readonly history: AttendanceHistory, private readonly records: AttendanceRecordRepository) {}`,
    good: `// application/projections/attendance-history.projection.ts
@Projection('scheduling.attendance-history', { feed: 'event-store' })
export class AttendanceHistoryProjection {
  constructor(private readonly history: AttendanceHistory) {}
}`,
  },
  'event-sourcing/upcaster-required': {
    why: "Stored events are never rewritten: an event stored years ago is read by today's code. Changing the type of the data of an event that is already stored breaks every replay of it, silently when the fields keep their names. The checkable criterion: the data of a stored event is a named type declared in its codec file, `encode` answers it, and its fingerprint (its fields and their types, layout and order aside) is recorded per version in stored-events.lock.json by `ddd-ts-kit docs --stored-events`, run when a version starts being stored (before the release that ships it), which never rewrites a recorded version. Reported: an encode that names no type, a type not declared in the file, a version above 1 without an upcaster from each version below it, a version below the last one recorded, and a recorded version whose shape changed. The lock is committed; until a version is recorded, its shape is free to change.",
    bad: `// infrastructure/persistence/attendance-record-events.mapper.ts
interface NoShowNotedData { readonly appointmentId: string; readonly reason: string } // a field added in place
'scheduling.attendance-record.no-show-noted': defineStoredEvent(NoShowNoted, { version: 1, encode: (event): NoShowNotedData => ({ ... }), decode }),`,
    good: `// infrastructure/persistence/attendance-record-events.mapper.ts
interface NoShowNotedData { readonly appointmentId: string; readonly reason: string }
'scheduling.attendance-record.no-show-noted': defineStoredEvent(NoShowNoted, {
  version: 2,
  encode: (event): NoShowNotedData => ({ ... }),
  decode,
  upcasters: { 1: (data) => ({ ...data, reason: '' }) },
}),`,
  },
};
