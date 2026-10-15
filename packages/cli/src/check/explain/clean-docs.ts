import type { RuleDoc } from '../model/rule-doc.js';

export const CLEAN_DOCS: Readonly<Record<string, RuleDoc>> = {
  'clean/stepdown': {
    why: 'A reader opens a file to learn what it does, then, if needed, how. With the public members first and each helper below its first caller, the file reads once from top to bottom, like a newspaper article. Helpers on top force the reader to hold details before knowing what they serve.',
    bad: `function parseLine(line: string) {}
export function parseFile(text: string) { return text.split('\\n').map(parseLine); }`,
    good: `export function parseFile(text: string) { return text.split('\\n').map(parseLine); }
function parseLine(line: string) {}`,
  },
  'clean/function-size': {
    why: 'A long function mixes several levels of abstraction, and its parts can be neither named nor tested alone. More than three parameters usually travel together because they are one concept without a type: name it, as a typed props object or a value object (`Contestation.create({ claim, reason, raisedBy, raisedAt })`), rather than adding a fourth parameter. Small functions with few arguments are what makes the stepdown order readable. The limits are configurable under `limits`, up to a ceiling: no function is longer than 100 lines, describe callbacks, module files and tests included, and that ceiling is an error whatever the severity of the rule. A `describe` longer than that covers several behaviours: the spec file holds one top-level `describe` per behaviour (a nested one counts in its parent), and a second spec file is needed only past the 350 lines of `clean/file-size`.',
    bad: `function issue(id: string, customer: string, amount: number, currency: string, dueOn: Date) {}`,
    good: `function issue(id: string, customer: CustomerId, total: Money) {}`,
  },
  'clean/no-commented-out-code': {
    why: 'Nobody dares to delete commented-out code: it looks important and is never run, compiled or tested. It rots while the code around it changes, and misleads the next reader. Version control keeps every past version without that cost.',
    bad: `// const total = lines.reduce((sum, line) => sum + line.amount, 0);`,
    good: `(nothing: the old version is in the history)`,
  },
  'clean/no-noise-comment': {
    why: 'A comment that repeats the name, draws a banner or records who changed what adds reading time and no information, and it drifts from the code it sits on. Comments are kept for what the code cannot say: why, a warning, an external reference.',
    bad: `/** Gets the order. */
getOrder(): Order {}
// ---------- helpers ----------`,
    good: `// Rounded half-even: required by the tax authority (art. 242).
round(amount: Money): Money {}`,
  },
  'clean/no-escape-hatch': {
    why: 'any, the non-null assertion and suppressed diagnostics tell the compiler to stop checking, and the error it would have reported comes back at run time, far from its cause. When one is really needed, the written reason is what lets a reviewer judge it.',
    bad: `const total = (order as any).lines!.length; // @ts-ignore`,
    good: `if (order.lines === undefined) throw new OrderWithoutLines(order.id);`,
  },
  'clean/no-flag-argument': {
    why: 'A boolean parameter means the method does two things, and the call site (`close(true)`) does not say which. Two methods named after the two intentions are readable at the call site and can each guard their own invariants.',
    bad: `cancel(refund: boolean): void {}`,
    good: `cancel(): void {}
cancelAndRefund(): void {}`,
  },
};
