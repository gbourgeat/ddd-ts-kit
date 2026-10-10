export const SEVERITIES = ['error', 'warn', 'off'] as const;

export type Severity = (typeof SEVERITIES)[number];
