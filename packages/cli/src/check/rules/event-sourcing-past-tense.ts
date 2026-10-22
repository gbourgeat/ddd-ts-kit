import { eventSourcedClasses } from '../event-sourcing/event-sourced-classes';
import { factWords } from '../event-sourcing/fact-words';
import type { Finding } from '../model/finding';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { isPastFact } from '../../naming';
import { perFile } from '../support/per-file';

const FIX =
  'Name the event after what happened, with a verb in the past tense: `InvoiceIssued`, `NoShowNoted`, `AmountWithdrawn`, `AppointmentMarkedNoShow`. A stored event is a fact that will be replayed for years; a name in the present or the imperative reads as a command.';

export const eventSourcingPastTense: Rule = {
  id: 'event-sourcing/past-tense',
  description:
    'The events an event-sourced aggregate imports from domain/events/ are named in the past tense: one word of the fact, the name after the aggregate, is a past participle that does not read as a command at its head.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      const aggregates = eventSourcedClasses(file).map(({ name }) => name);

      return aggregates.length === 0 ? [] : misnamed(file, aggregates);
    });
  },
};

function misnamed(file: SourceFile, aggregates: readonly string[]): Finding[] {
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
      .filter((name) => !isPastFact(factWords(name, aggregates)))
      .map((name) => ({ line, message: `The event ${name} is not named in the past tense.`, fix: FIX }));
  });
}
