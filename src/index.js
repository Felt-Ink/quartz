// Gates every request behind HTTP Basic Auth (passphrase only — username
// is ignored), then falls through to the static assets. If no passphrase
// is configured for this family (BASIC_AUTH_PASSWORD unset), the site is
// open — auth only kicks in once a family sets one via Decap CMS.

export default {
  async fetch(request, env) {
    if (env.BASIC_AUTH_PASSWORD && !isAuthorized(request, env)) {
      return unauthorized();
    }
    const response = await env.ASSETS.fetch(request);
    return withNoStore(response);
  },
};

// Cloudflare's edge cache sits in front of this Worker and will happily
// serve a cached response to unauthenticated requests without ever
// invoking fetch() again. Forcing no-store keeps every gated response
// (or an ungated one, if the family later removes their passphrase) live.
function withNoStore(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isAuthorized(request, env) {
  const header = request.headers.get("Authorization") || "";
  const [scheme, encoded] = header.split(" ");

  if (scheme !== "Basic" || !encoded) {
    return false;
  }

  let decoded;
  try {
    decoded = atob(encoded); // "username:password" (username can be blank)
  } catch {
    return false;
  }

  const password = decoded.slice(decoded.indexOf(":") + 1);
  return password === env.BASIC_AUTH_PASSWORD;
}

function unauthorized() {
  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Family Blog", charset="UTF-8"',
    },
  });
}