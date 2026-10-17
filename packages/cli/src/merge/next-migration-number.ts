/**
 * A number for a migration that sorts after `previous`, in its format, and not before `now`: a
 * timestamp to the second (`YYYYMMDDHHMMSS`, knex, Prisma, drizzle-kit), milliseconds since the
 * epoch (13 digits, TypeORM), or else the next whole number on as many digits.
 */
export function nextMigrationNumber(previous: string, now: Date): string {
  if (/^\d{14}$/.test(previous)) {
    const [year, month, day, hour, minute, second] = (previous.match(/^(\d{4})|\d{2}/g) ?? []).map(Number);
    const after = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, (second ?? 0) + 1);

    return new Date(Math.max(after, now.getTime())).toISOString().replace(/\D/g, '').slice(0, 14);
  }

  if (/^\d{13}$/.test(previous)) {
    return String(Math.max(Number(previous) + 1, now.getTime()));
  }

  return String(Number(previous) + 1).padStart(previous.length, '0');
}
