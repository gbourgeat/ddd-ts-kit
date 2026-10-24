import type { Rule } from '../model/rule';
import { personalTermOf } from '../privacy/personal-term-of';
import { privacyJudged } from '../privacy/privacy-judged';
import { type PublishedEventOf, publishedEventsOf } from '../privacy/published-events-of';
import { sameName } from '../privacy/same-name';
import { vocabularyOf } from '../privacy/vocabulary-of';
import { reporter } from '../support/reporter';

/**
 * A field of the payload of an integration event whose name says it holds personal data is
 * listed in the `personal` option of its declaration, `personal: { subject, fields }`: the event
 * catalog, the AsyncAPI document and the register say it then, and a context that copies it knows
 * it keeps a copy to erase. Read from the `z.object({...})` of the declaration and from the class or
 * the interface of its `.payload.ts`. Silent with `stack.privacy` off.
 */
export const privacyEventPayloadDeclared: Rule = {
  id: 'privacy/event-payload-declared',
  description:
    'A field of the payload of an integration event named like personal data is listed in the personal option of its declaration.',
  scope: 'project',
  run(project) {
    if (!privacyJudged(project)) {
      return [];
    }

    const vocabulary = vocabularyOf(project.config);
    const report = reporter(project, this.id);

    return publishedEventsOf(project).flatMap((event) =>
      event.payload.flatMap((field) => {
        const term = personalTermOf(field.name, vocabulary);

        return term === undefined || listed(event, field.name)
          ? []
          : [
              report(
                field,
                `The field ${field.name} of the payload of ${event.type} is named like personal data (${term}), and the personal option of the event does not list it: its consumers do not know they receive a copy of a person.`,
                `List it in the declaration of the event, \`personal: { subject: '<the field that names the person>', fields: ['${field.name}'] }\` in ${event.file}, or leave it out of the payload when no consumer needs it (data minimisation). A field that holds nothing of a person is recorded: \`// ddd-ts-kit-disable-next-line privacy/event-payload-declared -- ADR-NNNN: <why>\`.`,
              ),
            ];
      }),
    );
  },
};

/** The field is the subject, or one of the fields, a path compared by its last name. */
function listed(event: PublishedEventOf, name: string): boolean {
  const declared = event.personal === undefined ? [] : [event.personal.subject, ...event.personal.fields];

  return declared.some((path) => sameName(path.split('.').at(-1)?.replace('[]', '') ?? path, name));
}
