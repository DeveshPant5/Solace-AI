import { Platform } from 'react-native';

import { api, ApiError } from './api';

// Sign in with Google / Apple on the phone. Each returns an ID token for the
// Solace API to check (POST /auth/google, /auth/apple), or null when the person
// backs out. The native libraries are loaded on first use, so a build without
// them (Expo Go) only fails when the button is tapped, never on start.

export interface ProviderCredential {
  token: string;
  /** Apple shares the first name once, on the very first sign-in; it isn't in the token. */
  name?: string;
}

/** A message for the person. `gentle` ones aren't errors (e.g. Apple on Android) and are shown softly. */
export class SocialAuthError extends Error {
  constructor(
    message: string,
    public gentle = false,
  ) {
    super(message);
  }
}

// Read as literals so Expo inlines them at build time.
const BUILT_IN_GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();

const GOOGLE_NOT_SET_UP = "Google sign-in isn't set up yet. Email works in the meantime.";
let serverGoogleClientId: string | undefined;
let googleConfiguredWith: string | undefined;

/**
 * The Google Web client id: built into the app if set, otherwise the server's
 * (GET /auth/providers), so turning Google on in Render needs no APK rebuild.
 */
async function googleWebClientId(): Promise<string | undefined> {
  if (BUILT_IN_GOOGLE_WEB_CLIENT_ID) return BUILT_IN_GOOGLE_WEB_CLIENT_ID;
  if (serverGoogleClientId) return serverGoogleClientId;
  try {
    const r = await api<{ googleWebClientId: string | null }>('/auth/providers');
    serverGoogleClientId = r.googleWebClientId?.trim() || undefined;
    return serverGoogleClientId;
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) {
      throw new SocialAuthError("We couldn't reach Solace just now. Please check your connection and try again.");
    }
    return undefined;
  }
}

export async function googleCredential(): Promise<ProviderCredential | null> {
  if (Platform.OS === 'ios' && !GOOGLE_IOS_CLIENT_ID) throw new SocialAuthError(GOOGLE_NOT_SET_UP, true);
  const webClientId = await googleWebClientId();
  if (!webClientId) throw new SocialAuthError(GOOGLE_NOT_SET_UP, true);
  let lib: typeof import('@react-native-google-signin/google-signin');
  try {
    lib = await import('@react-native-google-signin/google-signin');
  } catch {
    throw new SocialAuthError('Google sign-in works in the installed Solace app. Email works here.', true);
  }
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = lib;
  if (googleConfiguredWith !== webClientId) {
    // The ID token is issued for the Web client id; the API accepts tokens for that id only.
    GoogleSignin.configure({ webClientId, ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}) });
    googleConfiguredWith = webClientId;
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    // Solace only needs to know who they are. Letting go of the Google session
    // means the account picker shows again next time (handy on a shared phone).
    void GoogleSignin.signOut().catch(() => undefined);
    if (!response.data.idToken) throw new SocialAuthError("Google didn't send what we need. Please try again.");
    return { token: response.data.idToken };
  } catch (e) {
    if (e instanceof SocialAuthError) throw e;
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return null;
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new SocialAuthError("Google sign-in needs Google Play services, which this phone doesn't have. Email works just as well.", true);
      }
      // Android's DEVELOPER_ERROR (code 10): the Android OAuth client doesn't match this build's package name and SHA-1.
      if (String(e.code) === '10' || /DEVELOPER_ERROR/i.test(e.message)) {
        console.warn('[google sign-in] DEVELOPER_ERROR: add an Android OAuth client for com.solace.companion with this build’s SHA-1');
        throw new SocialAuthError(GOOGLE_NOT_SET_UP, true);
      }
    }
    throw new SocialAuthError("Google sign-in didn't go through. Please try again.");
  }
}

export async function appleCredential(): Promise<ProviderCredential | null> {
  if (Platform.OS !== 'ios') {
    throw new SocialAuthError('Sign in with Apple works on iPhone. Here, Google or email will do nicely.', true);
  }
  const Apple = await import('expo-apple-authentication');
  if (!(await Apple.isAvailableAsync())) {
    throw new SocialAuthError("Sign in with Apple isn't available on this device. Email works just as well.", true);
  }
  try {
    const credential = await Apple.signInAsync({
      requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) throw new SocialAuthError("Apple didn't send what we need. Please try again.");
    return { token: credential.identityToken, name: credential.fullName?.givenName ?? undefined };
  } catch (e) {
    if (e instanceof SocialAuthError) throw e;
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw new SocialAuthError("Apple sign-in didn't go through. Please try again.");
  }
}
