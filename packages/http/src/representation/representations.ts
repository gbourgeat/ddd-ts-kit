import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { Schema } from '@ddd-ts-kit/validation';
import type { ResponseSpec } from '../route/response-spec';
import type { Route } from '../route/route';
import type { BodyShape } from './body-shape';
import { isJsonMediaType } from './is-json-media-type';
import { CsvRepresentation } from './csv/csv-representation';
import { JsonRepresentation } from './json-representation';
import type { Representation } from './representation';
import { XmlRepresentation } from './xml/xml-representation';

/** A representation chosen for a body, with the media type it is written under. */
export interface Chosen {
  readonly mediaType: string;
  readonly representation: Representation;
}

const JSON_MEDIA_TYPE = 'application/json';

/**
 * The media types an application answers and reads in, registered once in the platform and
 * given to the adapters (`representations` of the mount options) and to the contract generator,
 * which must be given the same. JSON is always there and always first: it is what a route
 * answers when the request says nothing, and what it refuses in when nothing else fits.
 */
export class Representations {
  private readonly byMediaType = new Map<string, Representation>();

  private readonly json: Representation;

  private constructor(representations: readonly Representation[]) {
    this.json = representations.find(({ mediaType }) => mediaType === JSON_MEDIA_TYPE) ?? new JsonRepresentation();

    for (const representation of [this.json, ...representations]) {
      this.byMediaType.set(representation.mediaType, representation);
    }
  }

  /** JSON, XML and CSV, the representations of the kit. */
  static standard(): Representations {
    return new Representations([new XmlRepresentation(), new CsvRepresentation()]);
  }

  /** JSON and the given ones; one given for `application/json` replaces the default. */
  static of(...representations: readonly Representation[]): Representations {
    return new Representations(representations);
  }

  /** What the route answers in, in its order of preference: JSON first, then what it declares in `produces`. */
  offeredBy(route: Pick<Route, 'produces'>): readonly string[] {
    return [JSON_MEDIA_TYPE, ...(route.produces ?? []).filter((type) => this.byMediaType.has(type))];
  }

  answerIn(mediaType: string): Chosen | undefined {
    const representation = this.byMediaType.get(mediaType);

    return representation === undefined ? undefined : { mediaType, representation };
  }

  /** The refusals of an answer negotiated in `mediaType`: its problem media type, else `application/problem+json`. */
  problemIn(mediaType: string | undefined): Chosen {
    const negotiated = mediaType === undefined ? undefined : this.byMediaType.get(mediaType);

    if (negotiated?.problemMediaType !== undefined) {
      return { mediaType: negotiated.problemMediaType, representation: negotiated };
    }

    return { mediaType: 'application/problem+json', representation: this.json };
  }

  /** The representation that reads a body sent in `mediaType`: JSON always, another when the route declares it in `consumes`. */
  readerOf(route: Pick<Route, 'consumes'>, mediaType: string): Representation | undefined {
    const consumed = isJsonMediaType(mediaType) || route.consumes?.includes(mediaType) === true;

    const representation = consumed
      ? this.byMediaType.get(isJsonMediaType(mediaType) ? JSON_MEDIA_TYPE : mediaType)
      : undefined;

    return representation?.read === undefined ? undefined : representation;
  }

  /** Refuses, when the routes are mounted, a media type no representation provides and a body it cannot write or read. */
  assertServes(routes: readonly Route[]): void {
    for (const route of routes) {
      for (const mediaType of route.produces ?? []) {
        this.assertWrites(route, mediaType);
      }

      for (const mediaType of route.consumes ?? []) {
        if (this.byMediaType.get(mediaType)?.read === undefined) {
          throw new DeclarationError(`Route "${route.operationId}" consumes ${mediaType}, which is never read.`);
        }
      }
    }
  }

  private assertWrites(route: Route, mediaType: string): void {
    const representation = this.byMediaType.get(mediaType);

    if (representation === undefined) {
      throw new DeclarationError(
        `Route "${route.operationId}" declares ${mediaType}, and no representation of the platform provides it.`,
      );
    }

    // A copy has a string index, which is how the statuses are enumerated.
    const declared: Readonly<Record<string, ResponseSpec>> = { ...route.responses };

    for (const response of Object.values(declared)) {
      const reason = response.body === undefined ? undefined : representation.refuses?.(shapeOf(route, response.body));

      if (reason !== undefined) {
        throw new DeclarationError(`Route "${route.operationId}" cannot answer in ${mediaType}: ${reason}.`);
      }
    }
  }
}

function shapeOf(route: Route, body: Schema<unknown>): BodyShape {
  return { schema: body.toJsonSchema(), name: route.operationId };
}
