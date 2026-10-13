export const RoleName = {
  Manager: 'manager',
  Practitioner: 'practitioner',
  Assistant: 'assistant',
} as const;

export type RoleName = (typeof RoleName)[keyof typeof RoleName];
