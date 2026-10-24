import type { TSESTree } from '@typescript-eslint/utils';
import { defineRule } from '../support/rule/define-rule';
import { testCall } from '../support/tests/test-call';
import { titleText } from '../support/tests/title-text';

/** What a title cites before the rule: the rows that make a scenario pass and its criterion, `#US5.02 AC1`, a criterion alone, `AC1`, a fix, `#FIX-412`. */
const CITATIONS = /^(?:#\S+\s+)*(?:AC\d+(?:\s*,\s*AC\d+)*\s+)?/;

/** The words that say a test is a test instead of saying what is true. */
const META =
  /\b(?:should|tests?|testing|tested|works|correctly|properly|successfully|as expected|makes? sure|ensures? that|verif(?:y|ies) that|checks? that)\b/i;

/** A word that names code: `execute()`, `execute(command)`, a first word in camelCase (`issueInvoice`). */
const CODE = /(?:[\w$]+\([^)]*\)|^[a-z]+[A-Z]\w*)/;

/** The first word of a table-driven title stands for a row: `%s is refused`, `$kind announces an appointment`. */
const PLACEHOLDER = /^[%$]/;

/** A group named after its tests instead of its subject. */
const GROUP_META = /\b(?:tests?|specs?|suite|should)\b|(?:Spec|Specs|Test|Tests)$/i;

type MessageId = 'rule' | 'word' | 'code' | 'group' | 'empty';

export const testTitleStatesARule = defineRule<MessageId>({
  id: 'test/title-states-a-rule',
  type: 'suggestion',
  recommended: 'error',
  description:
    'The title of a test states the rule it proves: in lower case, what the subject does, after the rows and the criterion it cites; never `should`, `test`, `works`, nor the name of a method or a class. A `describe` names the unit.',
  messages: {
    rule: 'The title "{{title}}" does not state the rule the test proves. A title says what the subject does, in the present tense and in lower case (`refuses to pay an invoice twice`, `saves the invoice and answers its identifier`), after the rows and the criterion it cites (`#US5.02 AC1 ...`).',
    word: 'The title "{{title}}" says "{{word}}": a title states the behaviour, not that it is tested. Write what is true afterwards, `records the payment of an invoice`, not `should record` or `works correctly`.',
    code: 'The title "{{title}}" names code (`{{code}}`). A title is in the words of the business, never the name of a method or a class: the reader learns the rule, and finds the code below.',
    group:
      'The group "{{title}}" is named after its tests. `describe` names the unit under test, the aggregate (`Invoice`), the use case (`Issue invoice`) or the route (`POST /invoices`), and each `it` states one of its rules.',
    empty: 'The title is empty: a test is named after the rule it proves, a group after the unit it tests.',
  },
  create({ file, sourceCode, report }) {
    if (!file.isTest) {
      return {};
    }

    return {
      CallExpression(node: TSESTree.CallExpression) {
        const call = testCall(sourceCode, node);
        const text = titleText(call?.title);

        if (call === undefined || text === undefined) {
          return;
        }

        const title = call.title ?? call.head;
        const problem = call.kind === 'group' ? groupProblem(text) : testProblem(text);

        if (problem !== undefined) {
          report({ node: title, messageId: problem.messageId, data: { title: text.trim(), ...problem.data } });
        }
      },
    };
  },
});

interface Problem {
  readonly messageId: MessageId;
  readonly data?: Record<string, string>;
}

function testProblem(text: string): Problem | undefined {
  const rule = text.replace(CITATIONS, '').trim();

  if (rule === '') {
    return { messageId: 'empty' };
  }

  const meta = META.exec(rule);

  if (meta !== null) {
    return { messageId: 'word', data: { word: meta[0] } };
  }

  const code = CODE.exec(rule);

  if (code !== null) {
    return { messageId: 'code', data: { code: code[0] } };
  }

  return PLACEHOLDER.test(rule) || /^[a-z]/.test(rule) ? undefined : { messageId: 'rule' };
}

function groupProblem(text: string): Problem | undefined {
  if (text.trim() === '') {
    return { messageId: 'empty' };
  }

  return GROUP_META.test(text.trim()) ? { messageId: 'group' } : undefined;
}
