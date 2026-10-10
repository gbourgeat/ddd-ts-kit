/**
 * One file `init` writes: its path in the project and its template under `templates/`. A
 * template ending in `.tpl` is rendered; any other is copied as it is (CI definitions hold
 * `${{ ... }}` expressions of their own).
 */
export type InitFile = readonly [target: string, template: string];
