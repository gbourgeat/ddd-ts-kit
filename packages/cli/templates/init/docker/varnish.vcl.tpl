vcl 4.1;

# Varnish in front of the API, for local development and CI. Written by `ddd-ts-kit init --http-cache varnish`.
# It keeps what the answers allow (Cache-Control of the route policies), files them under their tags (the `xkey`
# header the API sends), and purges them when the API asks (VarnishCachePurger of @ddd-ts-kit/http/purgers).
# A request with Authorization or Cookie is passed to the API, never answered from the cache: the built-in rules.
# A purge is a PURGE request naming its tags in xkey-purge (or xkey-softpurge), or one tag in x-ban-tag for a ban.

import xkey;

backend api {
    .host = "host.docker.internal";
    .port = "3000";
}

# Who may purge: the API, from this machine or a private network. Production names its own addresses.
acl purgers {
    "localhost";
    "127.0.0.1";
    "::1";
    "10.0.0.0"/8;
    "172.16.0.0"/12;
    "192.168.0.0"/16;
}

sub vcl_recv {
    if (req.method == "PURGE") {
        if (client.ip !~ purgers) {
            return (synth(403, "Forbidden"));
        }

        if (req.http.xkey-purge) {
            set req.http.x-purged = xkey.purge(req.http.xkey-purge);
        } elsif (req.http.xkey-softpurge) {
            set req.http.x-purged = xkey.softpurge(req.http.xkey-softpurge);
        } elsif (req.http.x-ban-tag) {
            # A ban instead of a purge: applied lazily to the objects whose xkey header names the tag.
            ban("obj.http.xkey ~ (^|\s)" + req.http.x-ban-tag + "(\s|$)");
            set req.http.x-purged = "a ban";
        } else {
            return (synth(400, "Name the tags in xkey-purge or xkey-softpurge, or one in x-ban-tag"));
        }

        return (synth(200, "Purged " + req.http.x-purged));
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
