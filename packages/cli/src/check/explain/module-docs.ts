import type { RuleDoc } from '../model/rule-doc';

export const MODULE_DOCS: Readonly<Record<string, RuleDoc>> = {
  'module/declared': {
    why: 'A module of the model divides one bounded context, one language, one schema and one consistency, into parts a reader opens separately. Evans: "Choose modules that tell the story of the system and contain a cohesive set of concepts. Give the modules names that become part of the ubiquitous language." A module named after a technical grouping (shared, common, core, utils) tells no story and becomes the place where everything else goes. The row of the "## Modules" table of CONTEXT.md says what each holds, so that a person or an agent picks the right one before opening a file. A part that needs its own glossary, its own schema or its own published language is not a module: it is another context.',
    bad: `"scheduling": { "modules": { "shared": {}, "calendar-stuff": {} } }
// CONTEXT.md has no "## Modules" section`,
    good: `"scheduling": { "modules": { "calendars": { "classification": "supporting" }, "waitlist": {} } }
// CONTEXT.md
## Modules
| Module | Purpose |
|---|---|
| \`calendars\` | The calendars, their opening hours, exceptions and time off. |
| \`waitlist\` | The waitlist of a calendar and the offers made to waiters. |`,
  },
  'module/complete': {
    why: 'A context half divided into modules is read two ways at once: a concept may be in its module or still at the level of the context, and the reader has to look in both. Once a context declares modules, every file of its domain/ and application/ belongs to one of them, except the generated declarations; the closed list of its error codes (<context>.codes.ts) and its permission set (<context>.permissions.ts) sit at the root of the context, outside every module. It is a warning so that a large context moves into its modules one cluster per commit, with `ddd-ts-kit move-to-module`, which rewrites the imports.',
    bad: `contexts/scheduling/domain/calendars/aggregates/calendar.aggregate.ts
contexts/scheduling/domain/aggregates/waitlist.aggregate.ts   // still at the level of the context`,
    good: `contexts/scheduling/domain/calendars/aggregates/calendar.aggregate.ts
contexts/scheduling/domain/waitlist/aggregates/waitlist.aggregate.ts
contexts/scheduling/scheduling.codes.ts                       // one per context, at its root`,
  },
  'module/no-cycle': {
    why: 'Modules that import each other in a cycle cannot be read, changed or later extracted one without the other. Evans makes the coupling between modules a signal about the model: "This often yields low coupling between modules, but if it doesn\'t look for a way to change the model to disentangle the concepts, or an overlooked concept that might be the basis of a module." So the rule warns instead of refusing, and points at the remedies of the model: a domain event for an effect that follows a decision, a module for the concept both reach for, a projection for reads.',
    bad: `// domain/calendars/aggregates/calendar.aggregate.ts
import { Waitlist } from '@/contexts/scheduling/domain/waitlist/aggregates/waitlist.aggregate.js';
// domain/waitlist/aggregates/waitlist.aggregate.ts
import { Calendar } from '@/contexts/scheduling/domain/calendars/aggregates/calendar.aggregate.js';`,
    good: `// application/waitlist/event-handlers/offer-freed-slot.event-handler.ts
import { SlotFreed } from '@/contexts/scheduling/domain/calendars/events/slot-freed.event.js';
// calendars imports nothing of waitlist: waitlist reacts to what calendars decided`,
  },
};
