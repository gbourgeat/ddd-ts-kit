/** The rules of the catalogue the example cannot break, each with the reason: an entry here is a debt, not a convenience. */
export const NOT_APPLICABLE: Readonly<Record<string, string>> = {
  'nest/controllers-current':
    'the example writes its routes as controllers of the kit ("stack.routes": "controllers"): it has no Nest controller whose generated list could fall behind',
};
