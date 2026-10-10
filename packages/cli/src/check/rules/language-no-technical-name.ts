import { splitWords } from '../../naming/index.js';
import { TECHNICAL_WORDS } from '../language/technical-words.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { inContext } from '../support/in-context.js';
import { perFile } from '../support/per-file.js';

const DECLARATION = /(?<![\w$.])(?:class|interface|enum|type)\s+([A-Za-z_$][\w$]*)/g;
const FIX = 'Name it with the noun or verb a domain expert uses for it; a technical suffix hides a concept that has no name yet.';

export const languageNoTechnicalName: Rule = {
  id: 'language/no-technical-name',
  description: 'No Manager, Helper, Util, Data, Info, Processor, Wrapper, Impl, Base, Abstract, Dto, Entity or Model in a name under domain/ or in a use case name.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      if (!namesTheModel(file)) return [];

      return [...file.scan.code.matchAll(DECLARATION)].flatMap((match) => {
        const name = match[1] ?? '';
        const technical = splitWords(name).filter((word) => TECHNICAL_WORDS.includes(word));

        if (technical.length === 0) return [];

        return [{ line: file.scan.lineAt(match.index), message: `${name} carries the technical word "${technical.join('", "')}".`, fix: FIX }];
      });
    });
  },
};

function namesTheModel(file: SourceFile): boolean {
  if (!inContext(file.location) || file.isTest) return false;

  const { layer, inside } = file.location;

  return layer === 'domain' || (layer === 'application' && (inside[0] === 'commands' || inside[0] === 'queries'));
}
