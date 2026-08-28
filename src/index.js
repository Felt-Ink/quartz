// Gates every request behind HTTP Basic Auth (passphrase only — username
// is ignored), then falls through to the static assets. If no passphrase
// is configured for this family (BASIC_AUTH_PASSWORD unset), the site is
// open — auth only kicks in once a family sets one via Decap CMS.

export default {
  async fetch(request, env) {
    if (env.BASIC_AUTH_PASSWORD && !isAuthorized(request, env)) {
      return unauthorized();
    }
    return env.ASSETS.fetch(request);
  },
};

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