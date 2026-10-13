/** The two formats a form is served in. */
export const FormFormat = { jsonForms: 'json-forms', blocks: 'blocks' } as const;

export type FormFormat = (typeof FormFormat)[keyof typeof FormFormat];
