import type { FormCondition } from './form-condition.js';
import type { FieldLookup } from './field-lookup.js';
import type { FormBlock } from './form-block.js';
import type { Widget } from './widget.js';

/** One field of a form described by the server, as the caller may use it. */
export interface FieldBlock {
  readonly type: 'field';
  /** The path of the field in the body, dotted for a field of a nested object: `patient.phone`. */
  readonly name: string;
  /** A translation key: `<operationId>.<field>`. */
  readonly label: string;
  readonly widget: Widget;
  readonly required: boolean;
  /** Present when the caller may see the field and not set it. */
  readonly readOnly?: true;
  /** What the schema says of the value: `minLength`, `maxLength`, `minimum`, `maximum`, `pattern`, `format`, `multipleOf`. */
  readonly constraints?: Readonly<Record<string, string | number | boolean>>;
  /** The values it may take, with the translation key of each: `<operationId>.<field>.<value>`. */
  readonly options?: readonly { readonly value: string | number | boolean; readonly label: string }[];
  /** Whether several options may be chosen: a list of values from a closed vocabulary. */
  readonly multiple?: true;
  /** The route whose items are the options. */
  readonly lookup?: FieldLookup;
  readonly visibleWhen?: FormCondition;
  readonly requiredWhen?: FormCondition;
  /** The value the request gave for it, when it gave one. */
  readonly value?: unknown;
  /** The fields of a nested object, for the widget `group`. */
  readonly blocks?: readonly FormBlock[];
}
