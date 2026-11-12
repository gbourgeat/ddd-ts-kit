/**
 * Whether a migration is a working one, by its name: `working-` right after the number, which
 * every migration tool keeps (Prisma writes it `working_`). Its order is decided when it lands.
 */
export function isWorkingMigration(name: string): boolean {
  return /^\d+[_-]working[_-]/.test(name);
}
