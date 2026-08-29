// Gates every request behind a passphrase-only login page (no username —
// HTTP Basic Auth's native browser prompt always shows one, so this uses
// a custom form + cookie instead), then falls through to static assets.
// If no passphrase is configured for this family (SITE_PASSPHRASE unset),
// the site is open — auth only kicks in once a family sets one via Decap.

const COOKIE_NAME = "felt_auth";

export default {
  async fetch(request, env) {
    const passphrase = env.SITE_PASSPHRASE;

    if (!passphrase) {
      return withNoStore(await env.ASSETS.fetch(request));
    }

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/__auth") {
      return handleLogin(request, passphrase);
    }

    if (await isAuthorized(request, passphrase)) {
      return withNoStore(await env.ASSETS.fetch(request));
    }

    return loginPage({ redirectTo: url.pathname + url.search });
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

async function isAuthorized(request, passphrase) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match != null && match[1] === (await sessionToken(passphrase));
}

async function handleLogin(request, passphrase) {
  const form = await request.formData();
  const submitted = form.get("passphrase") || "";
  const redirectTo = isSafeRedirect(form.get("redirect")) ? form.get("redirect") : "/";

  if (submitted !== passphrase) {
    return loginPage({ error: true, redirectTo });
  }

  const headers = new Headers({ Location: redirectTo });
  headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${await sessionToken(submitted)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
  );
  return new Response(null, { status: 302, headers });
}

// A hash of the passphrase, not the passphrase itself, is what lives in
// the browser's cookie jar — so a leaked cookie doesn't hand over the
// family's actual shared secret, just a token that's only useful here.
async function sessionToken(passphrase) {
  const data = new TextEncoder().encode(`${COOKIE_NAME}:${passphrase}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Only allow redirecting back to a same-site path, never to an
// absolute/external URL a login link could be crafted to smuggle in.
function isSafeRedirect(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}

function loginPage({ error = false, redirectTo = "/" } = {}) {
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Family Blog</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f4; }
  form { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); width: 100%; max-width: 320px; }
  h1 { font-size: 1.1rem; margin: 0 0 1rem; }
  input[type=password] { width: 100%; padding: 0.5rem; font-size: 1rem; box-sizing: border-box; margin-bottom: 0.75rem; }
  button { width: 100%; padding: 0.5rem; font-size: 1rem; cursor: pointer; }
  .error { color: #b91c1c; font-size: 0.875rem; margin: 0 0 0.75rem; }
</style>
</head>
<body>
<form method="POST" action="/__auth">
  <h1>Enter passphrase</h1>
  ${error ? '<p class="error">Wrong passphrase, try again.</p>' : ""}
  <input type="hidden" name="redirect" value="${escapeHtml(redirectTo)}">
  <input type="password" name="passphrase" autofocus required>
  <button type="submit">Enter</button>
</form>
</body>
</html>`;

  return new Response(body, {
    status: 401,
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "private, no-store",
    },
  });
}

function escapeHtml(str) {
  return str.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
