export const AppointmentStatus = {
  Requested: 'requested',
  Booked: 'booked',
  Cancelled: 'cancelled',
  Expired: 'expired',
  Completed: 'completed',
  NoShow: 'no-show',
} as const;

export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];
