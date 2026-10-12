import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../project/linted-file.js';
import { defineRule } from '../support/rule/define-rule.js';
import type { DeclaredValue } from '../support/vocabularies/declared-value.js';
import { projectVocabularies } from '../support/vocabularies/project-vocabularies.js';

type MessageId = 'raw';

/** The relationship schema of the access model declares its relations: like a published language, it names its values itself. */
const RELATIONSHIP_SCHEMA = /(?<![\w$.])defineSchema\s*\(/;

export const languageDeclaredVocabulary = defineRule<MessageId>({
  id: 'language/declared-vocabulary',
  type: 'suggestion',
  recommended: 'error',
  description:
    'A value of a closed vocabulary the project declares is read through it, never written again as a string literal: in its context, in the platform and the route groups for the platform, everywhere for a permission id.',
  messages: {
    raw: '"{{value}}" is a value of {{vocabularies}}. Write {{written}}, as a computed key `[..]:` for a key: the value is declared once, the editor completes it and a typo stops the build.',
  },
  create({ file, sourceCode, report }) {
    if (!isJudged(file) || RELATIONSHIP_SCHEMA.test(sourceCode.text)) {
      return {};
    }

    const declared = projectVocabularies(file);

    const judge = (node: TSESTree.Node, value: string): void => {
      const known = (declared.get(value) ?? []).filter((candidate) => isReadBy(file, candidate));

      if (known.length > 0 && !known.some((at) => at.file === file.path) && !isSpecifier(node)) {
        const vocabularies = known.map(({ vocabulary, file: at }) => `${vocabulary} (${at})`).join(' and of ');

        report({
          node,
          messageId: 'raw',
          data: { value, vocabularies, written: known.map(({ written }) => written).join(' or ') },
        });
      }
    };

    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          judge(node, node.value);
        }
      },
      TemplateLiteral(node) {
        const [only] = node.quasis;

        if (node.expressions.length === 0 && only !== undefined) {
          judge(node, only.value.cooked ?? only.value.raw);
        }
      },
    };
  },
});

/** Sources only: a test sends the values a client sends; a published language names the values of its contract itself. */
function isJudged(file: LintedFile): boolean {
  const published = file.location.area === 'context' && file.location.layer === 'published-language';

  return !file.isTest && !published && file.path.startsWith(`${file.config.sourceRoot}/`);
}

/** A vocabulary of a context is the language of that context alone; the one of the platform is read there and by the route groups, where a guard names a role. */
function isReadBy(file: LintedFile, { readBy }: DeclaredValue): boolean {
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
function isSpecifier(node: TSESTree.Node): boolean {
  const { parent } = node;

  return (
    parent?.type === AST_NODE_TYPES.ImportDeclaration ||
    parent?.type === AST_NODE_TYPES.ExportNamedDeclaration ||
    parent?.type === AST_NODE_TYPES.ExportAllDeclaration ||
    parent?.type === AST_NODE_TYPES.ImportExpression ||
    parent?.type === AST_NODE_TYPES.TSExternalModuleReference
  );
}
