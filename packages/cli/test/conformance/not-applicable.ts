/** The rules of the catalogue the example cannot break, each with the reason: an entry here is a debt, not a convenience. */
export const NOT_APPLICABLE: Readonly<Record<string, string>> = {
  'aspects/timeout-covers-delegate':
    'the example has one adapter that states a time limit, the mailer, and no adapter that is given the port of another: breaking the rule takes a second port, its adapter and their declarations, a slice rather than one violation',
  'nest/controllers-current':
    'the example writes its routes as controllers of the kit ("stack.routes": "controllers"): it has no Nest controller whose generated list could fall behind',
  'authz/system-actor-granted':
    'the example decides with an authorizer of its own, where a system actor operates its own context: the rule is silent there by design',
  'scheduling/job-registered':
    'the example is in the declared style, where a job is registered by its decorator and declarations/role-declared reports a class without it',
  'search/store-from-platform':
    'the example keeps no read model in OpenSearch and does not install @ddd-ts-kit/opensearch: an import of it would be unresolved before it is misplaced',
};
