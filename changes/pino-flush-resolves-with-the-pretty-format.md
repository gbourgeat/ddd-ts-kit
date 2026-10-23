**The flush of `PinoLogger` resolves with the pretty format, in a process with nothing else pending.**
Pino does not let the worker thread of a transport (`pino-pretty`) keep a process alive, so its
answer to a flush did not either: at shutdown, once everything else had closed, the process exited
before `flush()` resolved, and what came after it never ran. `app.stop()` flushes the logger last,
so it never resolved, and a program that awaited it at the top level ended with exit code 13. A
flush now keeps the process alive while it runs, ten seconds at most. The JSON format was not
affected.
