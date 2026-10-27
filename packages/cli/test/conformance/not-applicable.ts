/** The rules of the catalogue the example cannot break, each with the reason: an entry here is a debt, not a convenience. */
export const NOT_APPLICABLE: Readonly<Record<string, string>> = {
  'nest/controllers-current':
    'the example writes its routes as controllers of the kit ("stack.routes": "controllers"): it has no Nest controller whose generated list could fall behind',
  'authz/system-actor-granted':
    'the example decides with an authorizer of its own, where a system actor operates its own context: the rule is silent there by design',
  'scheduling/job-registered':
    'the example is in the declared style, where a job is registered by its decorator and declarations/role-declared reports a class without it',
};
