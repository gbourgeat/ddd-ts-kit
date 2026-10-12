/** The group the routes of one resource are moved to: one per first segment of their paths. */
export interface MigratedGroup {
  /** `appointments`, and `AppointmentsRoutes`. */
  readonly kebab: string;
  readonly className: string;
  readonly prefix: string;
  readonly tags: readonly string[];
  /** `FORBIDDEN` when every route of the group declares it: said once, on the group. */
  readonly errors: readonly string[];
}
