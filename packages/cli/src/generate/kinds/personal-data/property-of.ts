/** `customer_email` as a property of a row definition: `customerEmail`. */
export function propertyOf(column: string): string {
  return column.replace(/_+([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}
