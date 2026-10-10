/** `IssueInvoice`, `issue-invoice` and `issue invoice` all read `issue`, `invoice`. */
export function splitWords(input: string): string[] {
  return input
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => word.toLowerCase());
}
