import type { RuleDoc } from '../model/rule-doc';

export const MODULE_DOCS: Readonly<Record<string, RuleDoc>> = {
  'module/declared': {
    why: 'A module of the model divides one bounded context, one language, one schema and one consistency, into parts a reader opens separately. Evans: "Choose modules that tell the story of the system and contain a cohesive set of concepts. Give the modules names that become part of the ubiquitous language." A module named after a technical grouping (common, core, utils) tells no story and becomes the place where everything else goes; `shared` is no module either, it is the folder of what belongs to none, and config/valid refuses it as a name. The row of the "## Modules" table of CONTEXT.md says what each holds, so that a person or an agent picks the right one before opening a file. A part that needs its own glossary, its own schema or its own published language is not a module: it is another context.',
    bad: `"scheduling": { "modules": { "common": {}, "calendar-stuff": {} } }
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
    why: 'A context half divided into modules is read two ways at once: a concept may be in its module or still at the level of the context, and the reader has to look in both. Once a context declares modules, no layer folder stays at its root beside them: each module is one folder of the context holding its four layers and its tests (<module>/test/, with unit/, integration/, builders/ and fakes/), so that a part of the model is opened, moved and reviewed as one folder. A builder or a fake follows its subject, the aggregate or the port it is named after. What belongs to no module has one place: the closed list of its error codes (<context>.codes.ts) and its permission set (<context>.permissions.ts) at the root of the context, and in shared/ the schema and tables of its database (shared/infrastructure/persistence/), its route groups, guards and shared shapes (shared/presentation/http/), its worlds and the fakes, builders and specs of no module (shared/test/). shared/ holds no domain and no application: a concept two modules need belongs to one of them, or is a module. A file of a layer left at the level of the context, or a file of a module left in shared/, is a warning, so that a large context moves into its modules one cluster per commit with `ddd-ts-kit move-to-module`, which rewrites the imports and takes the specs of a moved file with it. The layout of an earlier version is an error whatever the severity of the rule: test/ at the level of the context, or a layer folder there that holds nothing but what shared/ holds now; `ddd-ts-kit context-layout` moves them.',
    bad: `contexts/scheduling/calendars/domain/aggregates/calendar.aggregate.ts
contexts/scheduling/domain/aggregates/waitlist.aggregate.ts                  // still at the level of the context
contexts/scheduling/shared/infrastructure/persistence/knex-waitlist.repository.ts   // an adapter of the waitlist, in shared/
contexts/scheduling/test/unit/calendars/calendar.aggregate.spec.ts           // the earlier layout: an error`,
    good: `contexts/scheduling/calendars/domain/aggregates/calendar.aggregate.ts
contexts/scheduling/calendars/test/unit/calendar.aggregate.spec.ts
contexts/scheduling/calendars/test/builders/calendar.builder.ts
contexts/scheduling/waitlist/domain/aggregates/waitlist.aggregate.ts
contexts/scheduling/waitlist/infrastructure/persistence/knex-waitlist.repository.ts
contexts/scheduling/shared/infrastructure/persistence/scheduling.schema.ts   // the database of the context
contexts/scheduling/shared/test/worlds/scheduling.world.ts
contexts/scheduling/scheduling.codes.ts                                      // one per context, at its root`,
  },
  'module/no-cycle': {
    why: 'Modules that import each other in a cycle cannot be read, changed or later extracted one without the other. Evans makes the coupling between modules a signal about the model: "This often yields low coupling between modules, but if it doesn\'t look for a way to change the model to disentangle the concepts, or an overlooked concept that might be the basis of a module." So the rule warns instead of refusing, and points at the remedies of the model: a domain event for an effect that follows a decision, a module for the concept both reach for, a projection for reads.',
    bad: `// calendars/domain/aggregates/calendar.aggregate.ts
import { Waitlist } from '@/contexts/scheduling/waitlist/domain/aggregates/waitlist.aggregate.js';
// waitlist/domain/aggregates/waitlist.aggregate.ts
import { Calendar } from '@/contexts/scheduling/calendars/domain/aggregates/calendar.aggregate.js';`,
    good: `// waitlist/application/event-handlers/offer-freed-slot.event-handler.ts
import { SlotFreed } from '@/contexts/scheduling/calendars/domain/events/slot-freed.event.js';
// calendars imports nothing of waitlist: waitlist reacts to what calendars decided`,
  },
};
