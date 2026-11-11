  it('runs "{{name.words}}" once {{job.name}} is enqueued', async () => {
    // TODO(domain): send, through the public API only (routes), the request whose use case enqueues {{job.className}}, with the builders of test/builders and generated data.

    const ran = await application.runDueJobs();

    await application.settled();

    // No job runs before a request enqueued it: this fails until the arrangement above is written.
    expect(ran).toContain('{{job.name}}');

    // TODO(domain): assert what a client or another context observes; never the database.
  });
