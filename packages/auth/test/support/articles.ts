import type { Actor } from '@ddd-ts-kit/kernel';
import { definePermissions, definePolicy } from '../../src';

export const publishingPermissions = definePermissions('publishing', {
  'article.edit': { description: 'Change the text of an article' },
  'article.read': { description: 'Read an article' },
});

export class Article {
  constructor(
    readonly id: string,
    readonly authorId: string,
    readonly publishedAt?: Date,
  ) {}
}

/** What would live in `application/authorization/only-author-edits-draft.policy.ts`. */
export const onlyAuthorEditsDraft = definePolicy<Article>({
  name: 'article.only-author-edits-draft',
  permission: publishingPermissions['article.edit'],
  appliesTo: (subject): subject is Article => subject instanceof Article,
  allows: (actor, article, { now }) =>
    actor.id === article.authorId && (article.publishedAt === undefined || article.publishedAt > now),
});

export const author: Actor = { id: 'ada', type: 'user', roles: ['writer'], attributes: {} };
export const reader: Actor = { id: 'bob', type: 'user', roles: ['writer'], attributes: {} };
