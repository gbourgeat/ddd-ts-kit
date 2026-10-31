import { CliError } from '../../cli-error';
import type { RuleDoc } from '../model/rule-doc';
import { DELEGATED_DOCS } from './delegated-docs';

/** The reason and the examples of a rule another tool decides; a rule without them is a bug of the kit. */
export function delegatedDoc(id: string): RuleDoc {
  const doc = DELEGATED_DOCS[id];

  if (doc === undefined) {
    throw new CliError(`The rule "${id}" has no explanation.`, 'Report this as a bug of ddd-ts-kit.');
  }

  return doc;
}
