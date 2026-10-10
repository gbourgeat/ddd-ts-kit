/** Per resource type, the schema permission each kit permission stands for: `{ document: { 'docs:document.edit': 'edit' } }`. */
export type PermissionMapping = Readonly<Record<string, Readonly<Record<string, string>>>>;
