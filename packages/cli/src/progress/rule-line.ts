/**
 * A rule line of the slices file, anywhere outside a table: `- #<row>: <invariants and failures
 * by name>`, or `- <row>: ..` without the `#`, as a plan written by hand often has it. A list item
 * whose first word is not the id of a row gives a rule no row asks for. Captures the id, then the text.
 */
export const RULE_LINE = /^\s*[-*]\s+#?([^\s:,#]+)\s*:\s*(.+?)\s*$/;
