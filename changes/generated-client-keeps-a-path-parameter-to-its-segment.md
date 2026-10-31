**A generated client keeps a path parameter to its own segment: an empty value, `.` and `..` throw a `TypeError` before anything is sent.** Every other value is percent-encoded as before. See [Client SDK](docs/tools/client-sdk.md).

To move: regenerate the clients (`ddd-ts-kit sdk`). A caller that passes such a value now gets the `TypeError`.
