import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload } from "jose";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import { oneLine } from "./text.js";

// Sign in with Google / Apple: the app gets an ID token (a JWT signed by the
// provider) and sends it here. It is only trusted after its signature, issuer,
// audience (our client id / bundle id) and expiry check out.

export type Provider = "google" | "apple";

export const PROVIDER_LABEL: Record<Provider, string> = { google: "Google", apple: "Apple" };

export interface VerifiedIdentity {
  provider: Provider;
  /** The provider's stable id for this person. */
  subject: string;
  email: string | null;
  emailVerified: boolean;
  /** First name, when the provider shares it in the token (Google does, Apple doesn't). */
  givenName: string | null;
}

const ISSUERS: Record<Provider, string[]> = {
  google: ["https://accounts.google.com", "accounts.google.com"],
  apple: ["https://appleid.apple.com"],
};

const keySets: Partial<Record<Provider, ReturnType<typeof createRemoteJWKSet>>> = {};

/** The provider's public signing keys, fetched on first use and cached (refetched when a new key id appears). */
function keysFor(provider: Provider) {
  return (keySets[provider] ??= createRemoteJWKSet(new URL(provider === "google" ? config.googleJwksUrl : config.appleJwksUrl), {
    timeoutDuration: 5_000,
    cooldownDuration: 30_000,
    cacheMaxAge: 6 * 60 * 60_000,
  }));
}

function audiencesFor(provider: Provider): string[] {
  return provider === "google" ? config.googleClientIds : config.appleAudiences;
}

export function providerEnabled(provider: Provider): boolean {
  return audiencesFor(provider).length > 0;
}

/** True when the provider's keys couldn't be fetched (as opposed to a bad token). */
function isUnreachable(err: unknown): boolean {
  if (!(err instanceof errors.JOSEError)) return true; // fetch failed (network, DNS)
  return err instanceof errors.JWKSTimeout || err instanceof errors.JWKSInvalid || err.code === "ERR_JOSE_GENERIC";
}

const truthy = (value: unknown) => value === true || value === "true";

/** Checks an ID token from Google or Apple and returns who it belongs to. Throws a friendly HttpError otherwise. */
export async function verifyIdentityToken(provider: Provider, token: string): Promise<VerifiedIdentity> {
  const label = PROVIDER_LABEL[provider];
  if (!providerEnabled(provider)) {
    throw new HttpError(503, `${label} sign-in isn't set up yet. Email works in the meantime.`, `${provider}_off`);
  }
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, keysFor(provider), {
      issuer: ISSUERS[provider],
      audience: audiencesFor(provider),
      algorithms: ["RS256"],
      requiredClaims: ["sub", "exp", "iat"],
      clockTolerance: 60,
      maxTokenAge: "1h",
    }));
  } catch (err) {
    if (isUnreachable(err)) {
      throw new HttpError(503, `We couldn't reach ${label} just now. Please try again in a moment.`, "provider_unreachable");
    }
    throw new HttpError(401, `That ${label} sign-in didn't go through. Please try again.`, "invalid_identity_token");
  }

  const subject = typeof payload.sub === "string" ? payload.sub : "";
  if (!subject || subject.length > 255) {
    throw new HttpError(401, `That ${label} sign-in didn't go through. Please try again.`, "invalid_identity_token");
  }
  const rawEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const email = rawEmail && rawEmail.length <= 254 && /^\S+@\S+\.\S+$/.test(rawEmail) ? rawEmail : null;
  const rawName = typeof payload.given_name === "string" ? payload.given_name : typeof payload.name === "string" ? payload.name : "";
  const givenName = oneLine(rawName).slice(0, 60) || null;

  return { provider, subject, email, emailVerified: email !== null && truthy(payload.email_verified), givenName };
}
