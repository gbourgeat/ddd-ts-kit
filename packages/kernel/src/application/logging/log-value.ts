/** What a field of a log entry holds. An `Error` is written as `describeError` describes it. */
export type LogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | Error
  | readonly LogValue[]
  | { readonly [key: string]: LogValue };
