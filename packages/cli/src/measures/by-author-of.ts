import type { AuthorMeasures } from './author-measures.js';
import { median } from './median.js';
import type { StoryMeasures } from './story-measures.js';

/** The stories of each author: how many, how many closed, the median lead time. */
export function byAuthorOf(stories: readonly StoryMeasures[]): Record<string, AuthorMeasures> {
  const authors: Record<string, AuthorMeasures> = {};

  for (const author of new Set(stories.map((story) => story.author ?? 'unknown'))) {
    const own = stories.filter((story) => (story.author ?? 'unknown') === author);
    const lead = median(own.flatMap((story) => story.leadHours ?? []));

    authors[author] = {
      stories: own.length,
      closed: own.filter((story) => story.leadHours !== undefined).length,
      ...(lead === undefined ? {} : { medianLeadHours: lead }),
    };
  }

  return authors;
}
