export type LogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | readonly LogValue[]
  | { readonly [key: string]: LogValue };
