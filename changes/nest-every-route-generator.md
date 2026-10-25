**Under `"stack.routes": "nest"`, every route generator writes the Nest form: a search, an upload, a form and a representation.**
`generate route` writes a search as a Nest controller, its page given in `@KitRoute` (`request:
{ query }`, `response.body: pageSchemaOf(line)`), where it used to refuse. `generate file-upload`
writes a Nest controller whose method takes `@Upload() file: IncomingFile`, the new parameter
decorator of `@ddd-ts-kit/http/nest`: the kit streams the file and checks it against the `upload`
of `@KitRoute`, which now takes `upload` and `form` as `@Controller` of the kit does; a method that
takes `@Upload()` with no `upload` declared is refused when the routes are built. `generate form`
and `generate representation` write their options at the top of `@KitRoute`, the form typed by the
body class. `nest/no-parallel-pipeline` points `@UploadedFile()` and `ParseFilePipe` at `@Upload()`.
`nest/controllers-current` reads `request: { query }` written short.
