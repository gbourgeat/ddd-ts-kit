import { parseGlossary, type Glossary } from '../check/language/parse-glossary';
import type { Scope } from './scope';

/** The glossary of the context of the command, read from its CONTEXT.md as it stands, `--term` rows included. */
export function glossaryOf(scope: Scope): Glossary {
  return parseGlossary(scope.ws.read(`${scope.dir}/CONTEXT.md`) ?? '');
}
