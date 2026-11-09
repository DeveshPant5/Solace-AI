// Web preview: Google's free native library has no web version, and Sign in
// with Apple is iPhone-only here. The buttons still show, with a gentle note.
import type { ProviderCredential } from './socialAuth';

export type { ProviderCredential } from './socialAuth';

export class SocialAuthError extends Error {
  constructor(
    message: string,
    public gentle = false,
  ) {
    super(message);
  }
}

export async function googleCredential(): Promise<ProviderCredential | null> {
  throw new SocialAuthError('Google sign-in works in the Solace phone app. Here, email will do nicely.', true);
}

export async function appleCredential(): Promise<ProviderCredential | null> {
  throw new SocialAuthError('Sign in with Apple works in the Solace app on iPhone. Here, email will do nicely.', true);
}
