/** The rules of the catalogue the example cannot break, each with the reason: an entry here is a debt, not a convenience. */
export const NOT_APPLICABLE: Readonly<Record<string, string>> = {
  'tenancy/scoped-statement':
    'The example serves one network of practices and says nothing of tenancy (its ADR-0003): the rule judges a project whose "stack.tenancy" is not "none", so it has nothing to judge there. The fixtures of `check --self` and the shared-table stacks of the end-to-end matrix prove it both ways.',
};
