/**
 * What a route states of a media type the kit knows no content rule for: `text`, held to the text
 * rule of the route (what a browser on Windows calls a CSV, `application/vnd.ms-excel`), or
 * `unchecked`, the bytes taken as they are, whatever they hold (`application/octet-stream`).
 */
export type StatedContentRule = 'text' | 'unchecked';
