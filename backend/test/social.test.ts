// Sign in with Google / Apple. A local stand-in publishes signing keys the way
// Google and Apple do (GOOGLE_JWKS_URL, APPLE_JWKS_URL), and the tests sign ID
// tokens with them. Throwaway accounts are deleted at the end.
import "./offline.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from "jose";

type Json = Record<string, any>;

const GOOGLE_CLIENT = "test-web-client.apps.googleusercontent.com";
const APPLE_BUNDLE = "com.solace.companion";

let googleKey: CryptoKey;
let appleKey: CryptoKey;
let jwks: Record<string, string> = {};

const keyServer = http.createServer((req, res) => {
  const body = jwks[req.url ?? ""];
  if (!body) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(body);
});

let base = "";
let server: http.Server;
let closePool: () => Promise<void>;
const tokens: string[] = [];

async function call(path: string, opts: { body?: unknown; token?: string; method?: string } = {}) {
  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: (text ? JSON.parse(text) : {}) as Json };
}

function googleToken(claims: Json, opts: { aud?: string; iss?: string; key?: CryptoKey; exp?: string } = {}) {
  return new SignJWT({ email_verified: true, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "google-1" })
    .setIssuer(opts.iss ?? "https://accounts.google.com")
    .setAudience(opts.aud ?? GOOGLE_CLIENT)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "10m")
    .sign(opts.key ?? googleKey);
}

function appleToken(claims: Json) {
  return new SignJWT({ email_verified: "true", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "apple-1" })
    .setIssuer("https://appleid.apple.com")
    .setAudience(APPLE_BUNDLE)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(appleKey);
}

const email = () => `social-${randomUUID()}@test.local`;

async function signInWith(provider: "google" | "apple", token: string, extra: Json = {}) {
  const r = await call(`/auth/${provider}`, { body: { token, timezone: "Asia/Kolkata", ...extra } });
  if (r.json.token) tokens.push(r.json.token);
  return r;
}

before(async () => {
  const google = await generateKeyPair("RS256");
  const apple = await generateKeyPair("RS256");
  googleKey = google.privateKey;
  appleKey = apple.privateKey;
  jwks = {
    "/google": JSON.stringify({ keys: [{ ...(await exportJWK(google.publicKey)), kid: "google-1", alg: "RS256", use: "sig" }] }),
    "/apple": JSON.stringify({ keys: [{ ...(await exportJWK(apple.publicKey)), kid: "apple-1", alg: "RS256", use: "sig" }] }),
  };
  await new Promise<void>((resolve) => keyServer.listen(0, "127.0.0.1", () => resolve()));
  const keys = `http://127.0.0.1:${(keyServer.address() as AddressInfo).port}`;
  process.env.GOOGLE_CLIENT_IDS = GOOGLE_CLIENT;
  process.env.GOOGLE_JWKS_URL = `${keys}/google`;
  process.env.APPLE_JWKS_URL = `${keys}/apple`;
  process.env.APPLE_AUDIENCES = APPLE_BUNDLE;

  const { migrate } = await import("../src/migrate.js");
  const { createApp } = await import("../src/app.js");
  const { pool } = await import("../src/db.js");
  closePool = () => pool.end();
  await migrate();
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  for (const token of tokens) await call("/me", { method: "DELETE", token }).catch(() => undefined);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await new Promise<void>((resolve) => keyServer.close(() => resolve()));
  await closePool();
});

describe("sign in with Google", () => {
  test("the app can read which buttons work and the Web client id", async () => {
    const r = await call("/auth/providers");
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { googleWebClientId: GOOGLE_CLIENT, apple: true });
  });

  test("a new Google account is created with onboarding answers, then signs back in", async () => {
    const sub = randomUUID();
    const address = email();
    const first = await signInWith("google", await googleToken({ sub, email: address.toUpperCase(), given_name: "Asha" }), {
      name: "Ash",
      tone: "cheerful",
      profile: { focus: ["sleep", "not-a-focus"], checkinTime: "morning" },
    });
    assert.equal(first.status, 201, JSON.stringify(first.json));
    assert.equal(first.json.created, true);
    assert.equal(first.json.user.email, address);
    assert.equal(first.json.user.name, "Ash", "the name typed in onboarding wins over Google's");
    assert.equal(first.json.user.preferences.tone, "cheerful");
    assert.deepEqual(first.json.user.profile.focus, ["sleep"]);
    assert.equal(first.json.user.timezone, "Asia/Kolkata");

    const reminders = await call("/reminders", { token: first.json.token });
    assert.equal(reminders.status, 200);
    assert.equal(reminders.json.reminders.length, 4, "gets the same default reminders as an email sign-up");

    const again = await signInWith("google", await googleToken({ sub, email: address }));
    assert.equal(again.status, 200);
    assert.equal(again.json.created, false);
    assert.equal(again.json.user.id, first.json.user.id);
  });

  test("without a typed name, Google's first name is used", async () => {
    const r = await signInWith("google", await googleToken({ sub: randomUUID(), email: email(), given_name: "Meera", name: "Meera K" }));
    assert.equal(r.status, 201);
    assert.equal(r.json.user.name, "Meera");
  });

  test("a Google account has no password to sign in with or change", async () => {
    const address = email();
    const r = await signInWith("google", await googleToken({ sub: randomUUID(), email: address }));
    assert.equal(r.status, 201);
    const login = await call("/auth/login", { body: { email: address, password: "anything-at-all" } });
    assert.equal(login.status, 401);
    assert.equal(login.json.error.code, "use_provider");
    assert.match(login.json.error.message, /Google/);
    const change = await call("/auth/password", { token: r.json.token, body: { currentPassword: "x", newPassword: "new-password-1" } });
    assert.equal(change.status, 400);
    assert.equal(change.json.error.code, "no_password");
  });

  test("an email that already has a password account is not taken over", async () => {
    const address = email();
    const signUp = await call("/auth/signup", { body: { name: "Pat", email: address, password: "password-123" } });
    assert.equal(signUp.status, 201);
    tokens.push(signUp.json.token);
    const r = await signInWith("google", await googleToken({ sub: randomUUID(), email: address }));
    assert.equal(r.status, 409);
    assert.equal(r.json.error.code, "use_password");
  });

  test("bad tokens are refused", async () => {
    const claims = { sub: randomUUID(), email: email() };
    const other = await generateKeyPair("RS256");
    const cases = [
      await googleToken(claims, { aud: "someone-elses-client.apps.googleusercontent.com" }),
      await googleToken(claims, { iss: "https://evil.example" }),
      await googleToken(claims, { key: other.privateKey }),
      await googleToken(claims, { exp: "-5m" }),
      await appleToken(claims), // an Apple token sent to the Google route
      "not.a.token-at-all-really",
    ];
    for (const token of cases) {
      const r = await signInWith("google", token);
      assert.equal(r.status, 401, `${r.status} ${JSON.stringify(r.json)}`);
      assert.equal(r.json.error.code, "invalid_identity_token");
    }
  });

  test("an unverified email can't make an account", async () => {
    const r = await signInWith("google", await googleToken({ sub: randomUUID(), email: email(), email_verified: false }));
    assert.equal(r.status, 400);
    assert.equal(r.json.error.code, "email_unverified");
  });
});

describe("sign in with Apple", () => {
  test("Apple's first-time name is used, later sign-ins find the same account", async () => {
    const sub = `001234.${randomUUID().replace(/-/g, "")}.0420`;
    const address = `${randomUUID()}@privaterelay.appleid.com`;
    const first = await signInWith("apple", await appleToken({ sub, email: address, is_private_email: "true" }), { name: "Kiran" });
    assert.equal(first.status, 201, JSON.stringify(first.json));
    assert.equal(first.json.user.name, "Kiran");
    // Apple only sends the name the first time; the token alone is enough afterwards.
    const again = await signInWith("apple", await appleToken({ sub, email: address }));
    assert.equal(again.status, 200);
    assert.equal(again.json.user.id, first.json.user.id);
  });

  test("with no name at all, Luma calls them friend", async () => {
    const r = await signInWith("apple", await appleToken({ sub: randomUUID(), email: email() }));
    assert.equal(r.status, 201);
    assert.equal(r.json.user.name, "friend");
  });

  test("the same verified email via Apple and Google reaches one account", async () => {
    const address = email();
    const viaGoogle = await signInWith("google", await googleToken({ sub: randomUUID(), email: address }));
    assert.equal(viaGoogle.status, 201);
    const viaApple = await signInWith("apple", await appleToken({ sub: randomUUID(), email: address }));
    assert.equal(viaApple.status, 200, JSON.stringify(viaApple.json));
    assert.equal(viaApple.json.user.id, viaGoogle.json.user.id);
    const login = await call("/auth/login", { body: { email: address, password: "whatever-123" } });
    assert.match(login.json.error.message, /Google or Apple/);
  });

  test("deleting the account removes the linked sign-in too", async () => {
    const sub = randomUUID();
    const address = email();
    const first = await signInWith("apple", await appleToken({ sub, email: address }));
    assert.equal(first.status, 201);
    assert.equal((await call("/me", { method: "DELETE", token: first.json.token })).status, 204);
    const again = await signInWith("apple", await appleToken({ sub, email: address }));
    assert.equal(again.status, 201, "a fresh account, not the deleted one");
    assert.notEqual(again.json.user.id, first.json.user.id);
  });
});
