import type { RenderContext } from '../../templating';

/** What the templates of a command or a query read, and the note about the world of its context the generator prints, if any. */
export interface UseCaseContext {
  readonly vars: RenderContext;
  readonly worldHint: string | undefined;
}
