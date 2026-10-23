export const AttendanceFact = {
  Opened: 'opened',
  NoShow: 'no-show',
  Cancellation: 'cancellation',
} as const;

export type AttendanceFact = (typeof AttendanceFact)[keyof typeof AttendanceFact];
