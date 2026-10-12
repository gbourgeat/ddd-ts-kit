import { declaredVocabularies } from '../language/declared-vocabularies.js';
import type { DeclaredValue } from '../language/declared-value.js';
import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import type { StringRecord } from '../scan/string-record.js';
import { inContext } from '../support/in-context.js';
import { perFile } from '../support/per-file.js';

const RELATIONSHIP_SCHEMA = /(?<![\w$.])defineSchema\s*\(/;
const MODULE_SPECIFIER = /\b(?:from|import)\s*$/;

export const languageDeclaredVocabulary: Rule = {
  id: 'language/declared-vocabulary',
  description:
    'A value of a closed vocabulary the project declares (an object `as const` with the union type of its name, a permission set of definePermissions) is read through it, never written again as a string literal outside its declaration, a quoted key included: the vocabulary of a context in that context, the one of the platform in the platform and the route groups of the contexts, a permission id everywhere; tests, published languages and the relationship schema are not judged.',
  scope: 'project',
  run(project) {
    const declared = declaredVocabularies(project.files);

    return perFile(project, this.id, (file) => (isJudged(file) ? rawValues(file, declared) : []));
  },
};

/**
 * A test spells the values it sends on purpose; a published language is a contract that names its
 * values itself, and so is the relationship schema of the access model, which declares its relations.
 */
function isJudged(file: SourceFile): boolean {
  const published = inContext(file.location) && file.location.layer === 'published-language';

  return !file.isTest && !published && !RELATIONSHIP_SCHEMA.test(file.scan.code);
}

function rawValues(file: SourceFile, declared: ReadonlyMap<string, readonly DeclaredValue[]>): Finding[] {
  return file.scan.strings.flatMap((literal) => {
    const values = (declared.get(literal.value) ?? []).filter((value) => isReadBy(file, value));

    if (
      values.length === 0 ||
      values.some(({ file: at }) => at === file.path) ||
      isSpecifier(file.scan.code, literal)
    ) {
      return [];
    }

    return [
      {
        line: literal.line,
        message: `"${literal.value}" is a value of ${values.map(({ vocabulary, file: at }) => `${vocabulary} (${at})`).join(' and of ')}.`,
        fix: `Write ${values.map(({ written }) => written).join(' or ')}, as a computed key \`[..]:\` for a key: the value is declared once, the editor completes it and a typo stops the build.`,
      },
    ];
  });
}

/** A vocabulary of a context is the language of that context alone; the one of the platform is read there and by the route groups, where a guard names a role. */
function isReadBy(file: SourceFile, { readBy }: DeclaredValue): boolean {
  const { location } = file;

  if (readBy === 'everywhere') {
    return true;
  }

  if (readBy === 'platform') {
    return location.area !== 'context' || file.path.endsWith('.routes.ts');
  }

  return location.area === 'context' && location.context === readBy.context;
}

/** The specifier of an import or an export names a module, not a value. */
function isSpecifier(code: string, literal: StringRecord): boolean {
  return MODULE_SPECIFIER.test(code.slice(Math.max(0, literal.start - 40), literal.start));
}
