import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, setAuthToken, setUnauthorizedHandler } from './api';
import { storage } from './storage';
import type { CheckinTime, Tone, User } from './types';

const TOKEN_KEY = 'solace.token';
const ONBOARDING_KEY = 'solace.onboarding';

export interface OnboardingAnswers {
  /** What Luma and Pip should call them; prefills sign-up. */
  name?: string;
  focus: string[];
  intention?: string;
  checkinTime: CheckinTime;
  tone: Tone;
}

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  user: User | null;
  onboarding: OnboardingAnswers | null;
  onboardingSeen: boolean;
  saveOnboarding(answers: OnboardingAnswers): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signUp(name: string, email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  updateUser(patch: Partial<Pick<User, 'name'>> & { profile?: User['profile']; preferences?: User['preferences'] }): Promise<User>;
  deleteAccount(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const timezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingAnswers | null>(null);
  const [onboardingSeen, setOnboardingSeen] = useState(false);

  const clearSession = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    setStatus('signedOut');
    await storage.remove(TOKEN_KEY);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void clearSession());
    (async () => {
      const [token, saved] = await Promise.all([storage.get(TOKEN_KEY), storage.getJSON<OnboardingAnswers>(ONBOARDING_KEY)]);
      if (saved) {
        setOnboarding(saved);
        setOnboardingSeen(true);
      }
      if (!token) return setStatus('signedOut');
      setAuthToken(token);
      try {
        const { user: me } = await api<{ user: User }>('/me');
        setUser(me);
        setOnboardingSeen(true);
        setStatus('signedIn');
        // Keep the server's timezone in sync with the phone (travel, DST).
        if (me.timezone !== timezone()) {
          void api<{ user: User }>('/me', { method: 'PATCH', body: { timezone: timezone() } }).then((r) => setUser(r.user)).catch(() => undefined);
        }
      } catch (e) {
        // Offline with a saved token: stay signed in; screens show their own errors.
        if ((e as { status?: number }).status === 0) setStatus('signedIn');
        else await clearSession();
      }
    })();
  }, [clearSession]);

  const finishAuth = useCallback(async (token: string, me: User) => {
    setAuthToken(token);
    await storage.set(TOKEN_KEY, token);
    setUser(me);
    setOnboardingSeen(true);
    setStatus('signedIn');
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      onboarding,
      onboardingSeen,
      async saveOnboarding(answers) {
        setOnboarding(answers);
        setOnboardingSeen(true);
        await storage.setJSON(ONBOARDING_KEY, answers);
      },
      async signIn(email, password) {
        const r = await api<{ token: string; user: User }>('/auth/login', { body: { email, password } });
        // An existing account has already been shown around: no tour or first-visit tips on this device.
        await (await import('@/components/PipTour')).markTourSeen(r.user.id).catch(() => undefined);
        await finishAuth(r.token, r.user);
      },
      async signUp(name, email, password) {
        const answers = onboarding;
        const r = await api<{ token: string; user: User }>('/auth/signup', {
          body: {
            name,
            email,
            password,
            timezone: timezone(),
            tone: answers?.tone,
            profile: answers
              ? { focus: answers.focus, intention: answers.intention || undefined, checkinTime: answers.checkinTime }
              : {},
          },
        });
        await finishAuth(r.token, r.user);
      },
      async signOut() {
        // Ends the session on the server too, so a copied token stops working. Offline is fine: sign out locally anyway.
        await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        const { cancelAllReminders } = await import('./notifications');
        await cancelAllReminders();
        (await import('./pipGrowth')).resetPipLevel();
        await clearSession();
      },
      async updateUser(patch) {
        const r = await api<{ user: User }>('/me', { method: 'PATCH', body: patch });
        setUser(r.user);
        return r.user;
      },
      async deleteAccount() {
        await api('/me', { method: 'DELETE' });
        const { cancelAllReminders } = await import('./notifications');
        await cancelAllReminders();
        (await import('./pipGrowth')).resetPipLevel();
        await storage.remove(ONBOARDING_KEY);
        setOnboarding(null);
        await clearSession();
      },
    }),
    [status, user, onboarding, onboardingSeen, finishAuth, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
