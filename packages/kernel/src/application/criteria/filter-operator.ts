export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'in'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'startsWith'
  | 'containsIgnoringCase'
  | 'startsWithIgnoringCase'
  | 'isNull'
  | 'between';
