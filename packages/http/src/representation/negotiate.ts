interface MediaRange {
  readonly type: string;
  readonly subtype: string;
  readonly quality: number;
}

const NOT_ACCEPTABLE = 0;
const EXACT = 2;
const SAME_TYPE = 1;

/**
 * The media type to answer in, among those the route offers in its order of preference, for an
 * `Accept` header (RFC 9110, 12.5.1): the offer of highest quality, the most specific range of the
 * header deciding the quality of each offer, the order of the offers breaking ties. Without the
 * header, the first offer; `undefined` when the header accepts none of them.
 */
export function negotiate(accept: string | undefined, offered: readonly string[]): string | undefined {
  if (accept === undefined || accept.trim() === '') {
    return offered[0];
  }

  const ranges = accept.split(',').flatMap(mediaRangeOf);
  let chosen: { readonly offer: string; readonly quality: number } | undefined;

  for (const offer of offered) {
    const quality = qualityOf(offer, ranges);

    if (quality > NOT_ACCEPTABLE && quality > (chosen?.quality ?? NOT_ACCEPTABLE)) {
      chosen = { offer, quality };
    }
  }

  return chosen?.offer;
}

function mediaRangeOf(text: string): MediaRange[] {
  const [range = '', ...parameters] = text.split(';').map((part) => part.trim().toLowerCase());
  const [type, subtype] = range.split('/');

  if (type === undefined || type === '' || subtype === undefined || subtype === '') {
    return [];
  }

  const weight = parameters.find((parameter) => parameter.startsWith('q='));
  const quality = weight === undefined ? 1 : Number(weight.slice(2));

  return [{ type, subtype, quality: Number.isFinite(quality) ? quality : NOT_ACCEPTABLE }];
}

/** The quality the most specific matching range gives the offer; 0 when none matches. */
function qualityOf(offer: string, ranges: readonly MediaRange[]): number {
  const [type = '', subtype = ''] = offer.toLowerCase().split('/');
  let best: { readonly specificity: number; readonly quality: number } | undefined;

  for (const range of ranges) {
    const specificity = specificityOf(range, { type, subtype });

    if (specificity !== undefined && specificity > (best?.specificity ?? -1)) {
      best = { specificity, quality: range.quality };
    }
  }

  return best?.quality ?? NOT_ACCEPTABLE;
}

function specificityOf(range: MediaRange, offer: Pick<MediaRange, 'type' | 'subtype'>): number | undefined {
  if (range.type === offer.type && range.subtype === offer.subtype) {
    return EXACT;
  }

  if (range.type === offer.type && range.subtype === '*') {
    return SAME_TYPE;
  }

  return range.type === '*' && range.subtype === '*' ? 0 : undefined;
}
