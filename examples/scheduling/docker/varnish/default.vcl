vcl 4.1;

# Varnish in front of the API, for local development and CI. Written by `ddd-ts-kit init --http-cache varnish`.
# It keeps only what an answer allows by name (the Cache-Control of a route policy, with max-age or s-maxage), files
# it under its tags (the `xkey` header the API sends), and purges them when the API asks (VarnishCachePurger of
# @ddd-ts-kit/http/purgers). A request with Authorization or Cookie is passed to the API, never answered from the
# cache: the built-in rules. A purge is a PURGE request naming its tags in xkey-purge (or xkey-softpurge), or one
# tag in x-ban-tag for a ban.

import std;
import xkey;

backend api {
    .host = "host.docker.internal";
    .port = "54300";
}

# Who may purge without the key: this machine only. Any other address sends the key Varnish was started with
# (VARNISH_PURGE_KEY of its environment) in x-purge-key; without one, it may not purge. In production, set a key of
# its own and keep the PURGE method away from the public side of the load balancer.
acl purgers {
    "localhost";
    "127.0.0.1";
    "::1";
}

sub vcl_recv {
    if (req.method == "PURGE") {
        if (client.ip !~ purgers && !(std.getenv("VARNISH_PURGE_KEY") != "" && req.http.x-purge-key == std.getenv("VARNISH_PURGE_KEY"))) {
            return (synth(403, "Forbidden"));
        }

        if (req.http.xkey-purge) {
            set req.http.x-purged = xkey.purge(req.http.xkey-purge);
        } elsif (req.http.xkey-softpurge) {
            set req.http.x-purged = xkey.softpurge(req.http.xkey-softpurge);
        } elsif (req.http.x-ban-tag) {
            # A ban instead of a purge, applied lazily to the objects whose xkey header names the tag. The purger
            # escapes the tag for the expression; a ban Varnish refuses is answered as a failure, and retried.
            if (!std.ban("obj.http.xkey ~ (^|\s)" + req.http.x-ban-tag + "(\s|$)")) {
                return (synth(500, "Ban refused: " + std.ban_error()));
            }

            set req.http.x-purged = "a ban";
        } else {
            return (synth(400, "Name the tags in xkey-purge or xkey-softpurge, or one in x-ban-tag"));
        }

        return (synth(200, "Purged " + req.http.x-purged));
    }
}

sub vcl_backend_response {
    # An answer whose route declared no policy says nothing of its freshness: it is never kept, whatever the
    # default TTL of Varnish would make of it (a public route without a policy, a problem, a probe). Varnish
    # remembers for two minutes not to wait on it (hit-for-miss), and keeps the next answer that allows it.
    if (beresp.http.cache-control !~ "(^|,)\s*(s-maxage|max-age)=") {
        set beresp.uncacheable = true;
        set beresp.ttl = 120s;

        return (deliver);
    }
}

sub vcl_deliver {
    # The tags are for this cache only; x-cache says whether the answer came from it.
    unset resp.http.xkey;

    if (obj.hits > 0) {
        set resp.http.x-cache = "HIT";
    } else {
        set resp.http.x-cache = "MISS";
    }
}
