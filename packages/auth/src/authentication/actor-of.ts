import type { Actor } from '@ddd-ts-kit/kernel';
import { sessionOf } from './session-of.js';

/**
 * The actor a boundary received, anonymous when there is none. Takes the principal (a session
 * or an actor) or the request context that holds it.
 */
export function actorOf(source: unknown): Actor {
  return sessionOf(source).actor;
}
