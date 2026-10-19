export const {{codes.list}} = {
  {{name.pascal}}: '{{error.code}}',
} as const;

export type {{codes.type}} = (typeof {{codes.list}})[keyof typeof {{codes.list}}];
