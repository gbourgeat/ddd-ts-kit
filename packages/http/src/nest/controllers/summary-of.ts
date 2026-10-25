/** The name of a method read as a sentence: `issueInvoice` gives `Issue invoice`. */
export function summaryOf(method: string): string {
  const words = method.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();

  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}
