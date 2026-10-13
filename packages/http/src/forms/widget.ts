/** How a field is entered: what a block of the form says, and what a renderer maps to a control of its own. */
export type Widget =
  | 'text'
  | 'textarea'
  | 'number'
  | 'checkbox'
  | 'select'
  | 'radio'
  | 'date'
  | 'datetime'
  | 'time'
  | 'email'
  | 'password'
  | 'group'
  | 'list';
