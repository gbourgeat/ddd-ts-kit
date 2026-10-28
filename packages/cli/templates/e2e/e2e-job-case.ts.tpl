  it('runs "{{name.words}}" when {{job.name}} is due', async () => {
    // TODO(domain): arrange what "{{name.words}}" acts on through the public API only (routes), with the builders of test/builders and generated data.

    await application.runJob('{{job.name}}');
    await application.settled();

    // TODO(domain): assert what a client or another context observes; never the database.
  });
