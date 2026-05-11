const targetEnv = process.argv.find((arg) => arg.startsWith("--env="))?.slice("--env=".length) ?? "staging";

const baseUrlByEnv = {
  production: process.env.SMOKE_BASE_URL_PRODUCTION ?? process.env.SMOKE_BASE_URL,
  staging: process.env.SMOKE_BASE_URL_STAGING ?? process.env.SMOKE_BASE_URL,
};

const emailByEnv = {
  production: process.env.SMOKE_EMAIL_PRODUCTION ?? process.env.SMOKE_EMAIL,
  staging: process.env.SMOKE_EMAIL_STAGING ?? process.env.SMOKE_EMAIL,
};

const passwordByEnv = {
  production: process.env.SMOKE_PASSWORD_PRODUCTION ?? process.env.SMOKE_PASSWORD,
  staging: process.env.SMOKE_PASSWORD_STAGING ?? process.env.SMOKE_PASSWORD,
};

function fail(message) {
  console.error(`Smoke test failed: ${message}`);
  process.exit(1);
}

function normalizeBaseUrl(input) {
  if (!input) {
    fail(`Missing base URL for ${targetEnv}. Set SMOKE_BASE_URL_${targetEnv.toUpperCase()} or SMOKE_BASE_URL.`);
  }

  const url = new URL(input);
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function logStep(message) {
  console.log(`• ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function berlinMapUrl(baseUrl) {
  const params = new URLSearchParams({
    east: "13.65",
    endAt: "2026-05-11T22:00:00.000Z",
    north: "52.62",
    openOnly: "false",
    pricing: "all",
    south: "52.34",
    startAt: "2026-05-11T08:00:00.000Z",
    west: "13.18",
  });
  return `${baseUrl}/api/map?${params.toString()}`;
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function mergeCookies(existingCookieHeader, response) {
  const jar = new Map();

  for (const part of (existingCookieHeader ?? "").split(/;\s*/).filter(Boolean)) {
    const [name, ...rest] = part.split("=");
    if (name) {
      jar.set(name, rest.join("="));
    }
  }

  for (const headerValue of getSetCookieHeaders(response)) {
    const firstPart = headerValue.split(";")[0] ?? "";
    const [name, ...rest] = firstPart.split("=");
    if (name) {
      jar.set(name, rest.join("="));
    }
  }

  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;

  if (text.length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }

  return { json, response };
}

async function run() {
  assert(targetEnv === "staging" || targetEnv === "production", `Unsupported environment "${targetEnv}".`);

  const baseUrl = normalizeBaseUrl(baseUrlByEnv[targetEnv]);

  logStep(`Running smoke checks against ${baseUrl} (${targetEnv})`);

  const health = await fetchJson(`${baseUrl}/api/health`);
  assert(health.response.ok, `/api/health returned ${health.response.status}`);
  assert(health.json?.ok === true, "/api/health did not return { ok: true }");

  const publicConfig = await fetchJson(`${baseUrl}/api/public-config`);
  assert(publicConfig.response.ok, `/api/public-config returned ${publicConfig.response.status}`);
  assert(publicConfig.json && "turnstileSiteKey" in publicConfig.json, "/api/public-config response shape changed");

  const groups = await fetchJson(`${baseUrl}/api/groups`);
  assert(groups.response.ok, `/api/groups returned ${groups.response.status}`);
  assert(Array.isArray(groups.json?.groups), "/api/groups did not return a groups array");

  const meetings = await fetchJson(`${baseUrl}/api/meetings`);
  assert(meetings.response.ok, `/api/meetings returned ${meetings.response.status}`);
  assert(Array.isArray(meetings.json?.meetings), "/api/meetings did not return a meetings array");

  const map = await fetchJson(berlinMapUrl(baseUrl));
  assert(map.response.ok, `/api/map returned ${map.response.status}`);
  assert(Array.isArray(map.json?.venues), "/api/map did not return a venues array");
  assert(Array.isArray(map.json?.meetings), "/api/map did not return a meetings array");

  const email = emailByEnv[targetEnv];
  const password = passwordByEnv[targetEnv];

  if (!email || !password) {
    logStep("Anonymous smoke checks passed. Skipping authenticated checks because smoke credentials are not configured.");
    return;
  }

  const login = await fetchJson(`${baseUrl}/api/auth/login`, {
    body: JSON.stringify({ email, password }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  assert(login.response.ok, `/api/auth/login returned ${login.response.status}`);
  assert(login.json?.user?.email, "/api/auth/login did not return a user payload");

  const cookieHeader = mergeCookies("", login.response);
  assert(cookieHeader.length > 0, "Login response did not set a session cookie");

  const me = await fetchJson(`${baseUrl}/api/me`, {
    headers: {
      cookie: cookieHeader,
    },
  });

  assert(me.response.ok, `/api/me returned ${me.response.status}`);
  assert(me.json?.viewer?.email?.toLowerCase() === email.toLowerCase(), "/api/me viewer email did not match smoke account");
  assert(Array.isArray(me.json?.groups), "/api/me did not return a groups array");
  assert(Array.isArray(me.json?.friends), "/api/me did not return a friends array");

  logStep("Authenticated smoke checks passed.");
}

await run();
