/** The dead-letter topic of one consumer for one topic: two consumers never share one. */
export function deadTopicOf(consumer: string, topic: string): string {
  return `${consumer}.${topic}.dead`;
}
