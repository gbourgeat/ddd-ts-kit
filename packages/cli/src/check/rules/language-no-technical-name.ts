import { splitWords } from '../../naming.js';
import type { Rule, SourceFile, Violation } from '../types.js';
import { inContext, reporter } from './helpers.js';

export const TECHNICAL_WORDS = ['manager', 'helper', 'util', 'utils', 'data', 'info', 'processor', 'wrapper', 'impl', 'base', 'abstract', 'dto', 'entity', 'model'];

const DECLARATION = /(?<![\w$.])(?:class|interface|enum|type)\s+([A-Za-z_$][\w$]*)/g;

export const languageNoTechnicalName: Rule = {
  id: 'language/no-technical-name',
  description: 'No Manager, Helper, Util, Data, Info, Processor, Wrapper, Impl, Base, Abstract, Dto, Entity or Model in a name under domain/ or in a use case name.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (!namesTheModel(file)) continue;
      for (const match of file.scan.code.matchAll(DECLARATION)) {
        const name = match[1] ?? '';
        const technical = splitWords(name).filter((word) => TECHNICAL_WORDS.includes(word));
        if (technical.length === 0) continue;
        violations.push(
          report(
            { file: file.path, line: file.scan.lineAt(match.index) },
            `${name} carries the technical word "${technical.join('", "')}".`,
            'Name it with the noun or verb a domain expert uses for it; a technical suffix hides a concept that has no name yet.',
          ),
        );
      }
    }
    return violations;
  },
};

function namesTheModel(file: SourceFile): boolean {
  if (!inContext(file.location) || file.isTest) return false;
  const { layer, inside } = file.location;
  return layer === 'domain' || (layer === 'application' && (inside[0] === 'commands' || inside[0] === 'queries'));
}
