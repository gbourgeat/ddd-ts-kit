import { OpenFgaModelError } from './open-fga-model-error';

/** What OpenFGA admits as a relation name: 1 to 50 characters, none of them `:`, `#`, `@` or a space. */
const OPENFGA_RELATION_NAME = /^[^:#@\s]{1,50}$/;
const PERMISSION_ID_SEPARATORS = /[:.]/g;

/**
 * The name a relation of the schema bears in the model of OpenFGA. A relation keeps its name. A
 * derived relation named after a permission id cannot, since OpenFGA refuses `:` in a relation
 * name: `docs:document.edit` becomes `docs_document_edit`, the same way everywhere (the model,
 * `Check`, `ListObjects`). No permission id holds `_`, so two ids never become one name.
 */
export function relationNameOf(name: string): string {
  const legal = name.replace(PERMISSION_ID_SEPARATORS, '_');

  if (!OPENFGA_RELATION_NAME.test(legal)) {
    throw new OpenFgaModelError(
      `"${name}" cannot be a relation of OpenFGA as "${legal}": a relation name has 1 to 50 characters, none of them ":", "#", "@" or a space.`,
    );
  }

  return legal;
}
