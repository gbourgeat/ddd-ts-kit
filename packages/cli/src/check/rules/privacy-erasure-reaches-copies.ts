import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { privacyJudged } from '../privacy/privacy-judged';
import { publishedEventsOf } from '../privacy/published-events-of';
import { escapeRegExp } from '../text/escape-reg-exp';
import { reporter } from '../support/reporter';

/** A context that erases what it keeps of a person: its own `PersonalDataErasure`, or a handler of the erasure announced. */
const ERASES = /\bextends\s+PersonalDataErasure\b|\bdataSubjectErasedV1\b|['"]privacy\.data-subject\.erased['"]/;

/**
 * A context that consumes an integration event whose payload carries personal data erases its copy
 * when the person is erased: it declares a `PersonalDataErasure` (which `privacy:erase` runs in the
 * monolith) or handles `privacy.data-subject.erased` (a context run as a service of its own). Read
 * in the files of the application layer of the consumer that name the definition of the event
 * (an integration handler, a projection, a process manager). A consumer that keeps nothing of the person records it. Silent with `stack.privacy` off.
 */
export const privacyErasureReachesCopies: Rule = {
  id: 'privacy/erasure-reaches-copies',
  description:
    'A context that consumes an integration event carrying personal data declares a PersonalDataErasure or handles privacy.data-subject.erased.',
  scope: 'project',
  run(project) {
    if (!privacyJudged(project)) {
      return [];
    }

    const report = reporter(project, this.id);
    const sources = project.files.filter((file) => !file.isTest && file.location.area === 'context');
    const erasing = new Set(sources.filter((file) => ERASES.test(file.scan.code)).map(contextOf));

    return publishedEventsOf(project)
      .filter((event) => event.personal !== undefined)
      .flatMap((event) =>
        consumersOf(project, event.constant)
          .filter((file) => contextOf(file) !== event.context && !erasing.has(contextOf(file)))
          .map((file) =>
            report(
              {
                file: file.path,
                line: file.scan.lineAt(
                  file.scan.code.search(new RegExp(String.raw`\b${escapeRegExp(event.constant)}\b`)),
                ),
              },
              `${contextOf(file)} consumes ${event.type}, whose payload carries personal data of ${event.personal?.subject ?? 'a person'}, and erases nothing when that person is erased: it declares no PersonalDataErasure and handles no privacy.data-subject.erased.`,
              `If ${contextOf(file)} keeps what it receives, declare the table that keeps it with \`ddd-ts-kit generate repository ${contextOf(file)} <Aggregate> --personal <column>,...\` (which writes its erasure, run by \`npm run privacy:erase\`), and, when it runs as a service of its own, \`ddd-ts-kit generate erasure-handler ${contextOf(file)}\`. If it keeps nothing of the person, record it: \`// ddd-ts-kit-disable-next-line privacy/erasure-reaches-copies -- ADR-NNNN: <why>\`.`,
            ),
          ),
      );
  },
};

/** The files of the application layer that name the definition of the event: its handlers, its projections, its process managers. */
function consumersOf(project: Project, constant: string): SourceFile[] {
  const named = new RegExp(String.raw`\b${escapeRegExp(constant)}\b`);

  return project.files.filter(
    (file) =>
      !file.isTest &&
      file.location.area === 'context' &&
      file.location.layer === 'application' &&
      named.test(file.scan.code),
  );
}

function contextOf(file: SourceFile): string {
  return file.location.area === 'context' ? file.location.context : '';
}
