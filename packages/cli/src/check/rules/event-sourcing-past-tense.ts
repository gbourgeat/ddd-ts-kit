import { eventSourcedClasses } from '../event-sourcing/event-sourced-classes.js';
import { wordsOf } from '../event-sourcing/words-of.js';
import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { isPastWord } from '../../naming/index.js';
import { perFile } from '../support/per-file.js';

const FIX =
  'Name the event after what happened, with a verb in the past tense: `InvoiceIssued`, `NoShowNoted`, `AmountWithdrawn`, `AppointmentMarkedNoShow`. A stored event is a fact that will be replayed for years; a name in the present or the imperative reads as a command.';

export const eventSourcingPastTense: Rule = {
  id: 'event-sourcing/past-tense',
  description:
    'The events an event-sourced aggregate imports from domain/events/ are named in the past tense: one word of the class name is a past participle.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => (eventSourcedClasses(file).length === 0 ? [] : misnamed(file)));
  },
};

function misnamed(file: SourceFile): Finding[] {
  return file.imports.flatMap(({ target, names, line }) => {
    const fromEvents =
      target.kind === 'file' &&
      target.location.area === 'context' &&
      target.location.layer === 'domain' &&
      target.location.inside[0] === 'events';

    if (!fromEvents) {
      return [];
    }

    return names
      .filter((name) => !wordsOf(name).some(isPastWord))
      .map((name) => ({ line, message: `The event ${name} is not named in the past tense.`, fix: FIX }));
  });
}
