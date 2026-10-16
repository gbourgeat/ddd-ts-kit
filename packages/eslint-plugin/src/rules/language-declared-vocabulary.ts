import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../project/linted-file.js';
import { defineRule } from '../support/rule/define-rule.js';
import type { DeclaredValue } from '../support/vocabularies/declared-value.js';
import { projectVocabularies } from '../support/vocabularies/project-vocabularies.js';

type MessageId = 'raw';

/** The relationship schema of the access model declares its relations: like a published language, it names its values itself. */
const RELATIONSHIP_SCHEMA = /(?<![\w$.])defineSchema\s*\(/;
/** The properties of an object that name a column, a table or a schema (`{ name: 'reason' }`). */
const NAME_PROPERTIES = new Set(['name', 'tableName', 'schema']);

export const languageDeclaredVocabulary = defineRule<MessageId>({
  id: 'language/declared-vocabulary',
  type: 'suggestion',
  recommended: 'error',
  description:
    'Under "stack.literals": "named", a value of a closed vocabulary the project declares is read through it, never written again as a string literal: in its context, in the platform and the route groups for the platform, everywhere for a permission id.',
  messages: {
    raw: '"{{value}}" is a value of {{vocabularies}}. Write {{written}}, as a computed key `[..]:` for a key: the value is declared once, the editor completes it and a typo stops the build.',
  },
  create({ context, file, sourceCode, report }) {
    if (file.config.stack.literals !== 'named' || !isJudged(file) || RELATIONSHIP_SCHEMA.test(sourceCode.text)) {
      return {};
    }

    const declared = projectVocabularies(file, context.languageOptions.parser);

    const judge = (node: TSESTree.Node, value: string): void => {
      const known = (declared.get(value) ?? []).filter((candidate) => isReadBy(file, candidate));

      if (known.length > 0 && !known.some((at) => at.file === file.path) && !isName(file, node)) {
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

/** A literal that names a module or a place of the storage, not a value. */
function isName(file: LintedFile, node: TSESTree.Node): boolean {
  return isSpecifier(node) || isStorageName(file, node);
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

/**
 * In the persistence of a context, the name of a column, a table or a schema is a word of the
 * storage that may spell a value by chance (a column `reason` next to a kind `reason`): the
 * first argument of a call, or the value of `name`, `tableName` or `schema`. A stored value, the
 * argument of `.default(..)` or a value compared in a query, is still judged.
 */
function isStorageName(file: LintedFile, node: TSESTree.Node): boolean {
  const { location } = file;
  const { parent } = node;

  const persistence =
    location.area === 'context' && location.layer === 'infrastructure' && location.inside[0] === 'persistence';

  if (!persistence || parent === undefined) {
    return false;
  }

  if (parent.type === AST_NODE_TYPES.CallExpression) {
    return parent.arguments[0] === node && calleeName(parent.callee) !== 'default';
  }

  return (
    parent.type === AST_NODE_TYPES.Property &&
    parent.value === node &&
    parent.key.type === AST_NODE_TYPES.Identifier &&
    NAME_PROPERTIES.has(parent.key.name)
  );
}

function calleeName(callee: TSESTree.Expression): string | undefined {
  if (callee.type === AST_NODE_TYPES.Identifier) {
    return callee.name;
  }

  return callee.type === AST_NODE_TYPES.MemberExpression && callee.property.type === AST_NODE_TYPES.Identifier
    ? callee.property.name
    : undefined;
}
