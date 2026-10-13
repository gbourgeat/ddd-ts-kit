/** A request header as one text: repeated lines joined as HTTP joins them, absent when not sent. */
export function headerText(value: string | readonly string[] | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === 'string' ? value : value.join(', ');
}
