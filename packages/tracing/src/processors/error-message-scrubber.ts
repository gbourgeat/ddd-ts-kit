import type { EndedSpan } from './ended-span.js';

/**
 * Removes what `recordException` and instrumentations copy from an error: the
 * `exception.message` and `exception.stacktrace` event attributes and the status
 * message. `exception.type` stays.
 */
export class ErrorMessageScrubber {
  onStart(): void {}

  onEnd(span: EndedSpan): void {
    for (const event of span.events) {
      if (event.attributes === undefined) {
        continue;
      }

      delete event.attributes['exception.message'];
      delete event.attributes['exception.stacktrace'];
    }

    delete span.status.message;
  }

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {}
}
