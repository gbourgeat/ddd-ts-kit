import { defineRule } from '../support/rule/define-rule.js';
import { MemberUses } from '../support/stepdown/member-uses.js';
import { misplacedMembers, type ClassMessageId } from '../support/stepdown/misplaced-members.js';
import { misplacedFunctions } from '../support/stepdown/misplaced-functions.js';

export const cleanStepdown = defineRule<ClassMessageId | 'functionAboveCaller'>({
  id: 'clean/stepdown',
  type: 'suggestion',
  recommended: 'error',
  description: 'A file reads top to bottom: static factories, public members, then private ones, and a function above the functions it calls.',
  messages: {
    nonPublicBeforePublic:
      'The {{visibility}} member {{name}} of {{className}} is declared before the public member {{publicName}}. Move {{name}} below the public members, after its first caller: a reader meets what the class does before how.',
    staticAfterInstance:
      'The static method {{name}} of {{className}} is declared after the instance method {{instanceName}}. Move the static factories to the top of the class, above the instance methods.',
    memberAboveCaller: 'The private member {{name}} of {{className}} is declared above its first caller (line {{line}}). Move {{name}} just below the member that first calls it.',
    functionAboveCaller:
      'The function {{name}} is declared above its first caller (line {{line}}). Move {{name}} below the function that first calls it, so that the file reads from intention to detail.',
  },
  create({ sourceCode, report }) {
    const uses = new MemberUses();

    return {
      MemberExpression: (node) => uses.record(node),
      'ClassBody:exit'(node) {
        for (const finding of misplacedMembers(node, uses.of(node))) report(finding);
      },
      'Program:exit'(node) {
        for (const finding of misplacedFunctions(node, sourceCode)) report({ ...finding, messageId: 'functionAboveCaller' });
      },
    };
  },
});
