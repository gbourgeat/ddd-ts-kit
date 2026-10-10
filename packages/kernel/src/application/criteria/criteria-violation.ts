export type CriteriaViolationCode =
  | 'unknown_field'
  | 'operator_not_allowed'
  | 'invalid_value'
  | 'in_list_too_long'
  | 'empty_group'
  | 'too_deep'
  | 'too_many_filters'
  | 'unsortable_field'
  | 'page_too_large'
  | 'invalid_cursor';

/**
 * Why a criteria is refused by a definition. `path` is `filter.<field>`, `filter`, `sort` or
 * `page.<part>`; the `code` is the stable contract; the message names the rule, never the
 * value that broke it.
 */
export interface CriteriaViolation {
  readonly path: string;
  readonly code: CriteriaViolationCode;
  readonly message: string;
}
