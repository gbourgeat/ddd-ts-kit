import { isAggregateFile } from '../support/event-sourcing/is-aggregate-file.js';
import { isEventSourcedClass } from '../support/event-sourcing/is-event-sourced-class.js';
import { isPastParticiple } from '../support/event-sourcing/is-past-participle.js';
import { wordsOf } from '../support/event-sourcing/words-of.js';
import { importListener, type ImportedName } from '../support/imports/import-listener.js';
import { defineRule } from '../support/rule/define-rule.js';

export const eventSourcingPastTense = defineRule<'presentTense'>({
  id: 'event-sourcing/past-tense',
  type: 'suggestion',
  recommended: 'error',
  description:
    'The events an event-sourced aggregate imports from domain/events/ are named in the past tense: one word of the class name is a past participle.',
  messages: {
    presentTense:
      'The event {{name}} is not named in the past tense. Name it after what happened (`InvoiceIssued`, `NoShowNoted`, `AmountWithdrawn`): a stored event is a fact replayed for years, a name in the present reads as a command.',
  },
  create({ file, report }) {
    if (!isAggregateFile(file)) {
      return {};
    }

    const events: ImportedName[] = [];
    let eventSourced = false;

    return {
      ...importListener(file, ({ target, names }) => {
        const fromEvents =
          target.kind === 'file' &&
          target.location.area === 'context' &&
          target.location.layer === 'domain' &&
          target.location.inside[0] === 'events';

        if (fromEvents) {
          events.push(...names);
        }
      }),
      ClassDeclaration(node) {
        eventSourced ||= isEventSourcedClass(node);
      },
      'Program:exit'() {
        for (const { name, node } of eventSourced ? events : []) {
          if (!wordsOf(name).some(isPastParticiple)) {
            report({ node, messageId: 'presentTense', data: { name } });
          }
        }
      },
    };
  },
});
