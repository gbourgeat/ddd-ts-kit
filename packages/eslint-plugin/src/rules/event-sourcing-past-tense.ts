import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { isAggregateFile } from '../support/event-sourcing/is-aggregate-file';
import { isEventSourcedClass } from '../support/event-sourcing/is-event-sourced-class';
import { factWords } from '../support/event-sourcing/fact-words';
import { isPastFact } from '../support/event-sourcing/is-past-fact';
import { importListener, type ImportedName } from '../support/imports/import-listener';
import { defineRule } from '../support/rule/define-rule';

export const eventSourcingPastTense = defineRule<'presentTense'>({
  id: 'event-sourcing/past-tense',
  type: 'suggestion',
  recommended: 'error',
  description:
    'The events an event-sourced aggregate imports from domain/events/ are named in the past tense: one word of the fact, the name after the aggregate, is a past participle that does not read as a command at its head.',
  messages: {
    presentTense:
      'The event {{name}} is not named in the past tense. Name it after what happened (`InvoiceIssued`, `NoShowNoted`, `AmountWithdrawn`): a stored event is a fact replayed for years, a name in the present reads as a command.',
  },
  create({ file, report }) {
    if (!isAggregateFile(file)) {
      return {};
    }

    const events: ImportedName[] = [];
    const aggregates: string[] = [];

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
        if (isEventSourcedClass(node) && node.id !== null) {
          aggregates.push(node.id.name);
        }
      },
      'Program:exit'() {
        for (const imported of aggregates.length > 0 ? events : []) {
          const name = localName(imported);

          if (!isPastFact(factWords(name, aggregates))) {
            report({ node: imported.node, messageId: 'presentTense', data: { name } });
          }
        }
      },
    };
  },
});

/** The name the aggregate writes, as the checker reads it: the local one of a renamed import. */
function localName({ name, node }: ImportedName): string {
  return node.type === AST_NODE_TYPES.ImportSpecifier ? node.local.name : name;
}
