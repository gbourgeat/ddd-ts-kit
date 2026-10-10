/**
 * The one method the store calls on the model of the processed events, typed structurally:
 * the delegate of your generated client (`client.processedEvent`) fits as is on the databases
 * where Prisma offers `skipDuplicates` (PostgreSQL, MySQL, CockroachDB).
 */
export interface PrismaProcessedEventDelegate {
  createMany(args: {
    data: { consumer: string; eventId: string }[];
    skipDuplicates: true;
  }): Promise<{ count: number }>;
}
