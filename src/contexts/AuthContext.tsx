import React, { createContext, useCallback, useEffect, useMemo, useState, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session as SupabaseSession, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: SignupData) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  loading: boolean;
}

interface SignupData {
  name: string;
  email: string;
  password: string;
  role: User['role'];
  userType: string;
}

export const AuthContext = createContext<AuthContextType>(
  Object.freeze({
    user: null,
    login: async () => {},
    signup: async () => ({ success: false, message: '' }),
    logout: async () => {},
    loading: true,
  })
);

interface AuthProviderProps {
  children: React.ReactNode;
}

const DEFAULT_SUPER_ADMIN_EMAIL = 'reycelrcentino@gmail.com';
const ALLOWED_ADMIN_ROLES: User['role'][] = ['admin', 'superadmin'];

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const RESEND_COOLDOWN_MS = 120_000; // 2 minutes
const RESEND_COOLDOWN_STORAGE_KEY = 'lastConfirmationResendAt';

let lastConfirmationResendAt: number | null = null;

const getStoredResendTimestamp = async (): Promise<number | null> => {
  if (lastConfirmationResendAt !== null) {
    return lastConfirmationResendAt;
  }

  try {
    const stored = await AsyncStorage.getItem(RESEND_COOLDOWN_STORAGE_KEY);
    if (stored) {
      const parsed = Number(stored);
      if (!Number.isNaN(parsed)) {
        lastConfirmationResendAt = parsed;
        return parsed;
      }
    }
  } catch (storageError) {
    console.warn('Unable to read resend cooldown timestamp:', storageError);
  }
  return null;
};

const setStoredResendTimestamp = async (timestamp: number) => {
  lastConfirmationResendAt = timestamp;
  try {
    await AsyncStorage.setItem(RESEND_COOLDOWN_STORAGE_KEY, String(timestamp));
  } catch (storageError) {
    console.warn('Unable to persist resend cooldown timestamp:', storageError);
  }
};

type ResendResult = 'sent' | 'throttled' | 'failed' | 'skipped';

const resendConfirmationEmail = async (email: string): Promise<ResendResult> => {
  const target = normalizeEmail(email);
  if (!target) {
    return 'skipped';
  }

  const now = Date.now();
  const lastResend = await getStoredResendTimestamp();

  if (lastResend && now - lastResend < RESEND_COOLDOWN_MS) {
    console.warn('Skipped Supabase email confirmation resend: throttled by client guard.');
    return 'throttled';
  }

  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: target,
    });

    if (error) {
      console.warn('Supabase email confirmation resend failed:', error.message);
      return 'failed';
    }
    await setStoredResendTimestamp(now);
    return 'sent';
  } catch (resendError) {
    console.warn('Supabase email confirmation resend threw:', resendError);
    return 'failed';
  }
};

const buildUserFromProfile = (authUser: SupabaseAuthUser, profile: any | null): User => {
  const email = authUser.email ?? profile?.email ?? '';
  const nameFromProfile = profile?.name as string | undefined;
  const metadataName = (authUser.user_metadata?.full_name as string | undefined) ?? (email ? email.split('@')[0] : undefined);
  const resolvedName = nameFromProfile || metadataName || 'Admin User';
  const roleFromProfile = profile?.role as User['role'] | undefined;
  const metadataRole = authUser.user_metadata?.role as User['role'] | undefined;
  const resolvedRole: User['role'] = roleFromProfile || metadataRole || 'admin';
  const statusFromProfile = profile?.status as User['status'] | undefined;
  const profileImage = profile?.profile_image ?? profile?.avatar ?? undefined;
  const createdAt = profile?.created_at ?? authUser.created_at ?? new Date().toISOString();

  return {
    id: authUser.id,
    email,
    name: resolvedName,
    role: resolvedRole,
    userType: (profile?.role as string | undefined) ?? resolvedRole,
    status: statusFromProfile ?? 'active',
    phone: profile?.phone ?? undefined,
    profileImage,
    createdAt,
    lastLogin: new Date().toISOString(),
    permissions: (authUser.user_metadata?.permissions as string[] | undefined) ?? [],
  };
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const cacheUser = useCallback(async (value: User | null) => {
    try {
      if (value) {
        await AsyncStorage.setItem('userData', JSON.stringify(value));
      } else {
        await AsyncStorage.removeItem('userData');
      }
    } catch (storageError) {
      console.warn('Failed to cache user data:', storageError);
    }
  }, []);

  const cacheAuthToken = useCallback(async (token: string | null) => {
    try {
      if (token) {
        await AsyncStorage.setItem('authToken', token);
      } else {
        await AsyncStorage.removeItem('authToken');
      }
    } catch (storageError) {
      console.warn('Failed to cache auth token:', storageError);
    }
  }, []);

  const syncProfile = useCallback(
    async (authUser: SupabaseAuthUser) => {
      try {
        const { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        let resolvedProfile = profile ?? null;

        if (!profile && !error) {
          const payload = {
            id: authUser.id,
            email: authUser.email,
            name: (authUser.user_metadata?.full_name as string | undefined) ?? authUser.email ?? 'Admin User',
            role: (authUser.user_metadata?.role as User['role'] | undefined) ?? 'admin',
            status: 'active',
          };

          const { data: insertedProfile, error: insertError } = await supabase
            .from('users')
            .insert(payload)
            .select('*')
            .single();

          if (insertError) {
            console.warn('Failed to create Supabase user profile:', insertError);
          } else {
            resolvedProfile = insertedProfile;
          }
        } else if (error) {
          console.warn('Failed to load Supabase profile:', error);
        }

        const normalizedUser = buildUserFromProfile(authUser, resolvedProfile);

        if (!ALLOWED_ADMIN_ROLES.includes(normalizedUser.role)) {
          console.warn('[Auth] Blocked sign-in for disallowed role:', normalizedUser.role);
          await supabase.auth.signOut();
          setUser(null);
          await cacheUser(null);
          throw new Error('Access restricted: only admin accounts may sign in.');
        }

        setUser(normalizedUser);
        await cacheUser(normalizedUser);
      } catch (profileError) {
        console.error('❌ Unable to sync Supabase profile:', profileError);
        setUser(null);
        await cacheUser(null);
      }
    },
    [cacheUser]
  );

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;

        if (session?.user) {
          await cacheAuthToken(session.access_token ?? null);
          try {
            await syncProfile(session.user);
          } catch (syncError) {
            console.warn('[Auth] Failed to sync profile during bootstrap:', syncError);
            await cacheAuthToken(null);
          }
        } else {
          await cacheAuthToken(null);
          const cached = await AsyncStorage.getItem('userData');
          if (cached) {
            const parsed: User = JSON.parse(cached);
            if (isMounted) {
              setUser(parsed);
            }
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) {
        return;
      }

      if (session?.user) {
        await cacheAuthToken(session.access_token ?? null);
        try {
          await syncProfile(session.user);
        } catch (syncError) {
          console.warn('[Auth] Failed to sync profile during auth state change:', syncError);
          await cacheAuthToken(null);
        }
      } else {
        setUser(null);
        await cacheUser(null);
        await cacheAuthToken(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [cacheAuthToken, cacheUser, syncProfile]);

  const cacheSessionToken = useCallback(
    async (session: SupabaseSession | null) => {
      await cacheAuthToken(session?.access_token ?? null);
    },
    [cacheAuthToken]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const trimmedEmail = normalizeEmail(email);
      console.log('[login] calling signInWithPassword');
      let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data'];
      let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['error'];

      try {
        ({ data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password }));
      } catch (networkError) {
        console.error('[login] signInWithPassword threw', networkError);
        throw new Error('Unable to reach Supabase. Check your network connection and try again.');
      }

      if (error || !data.session?.user) {
        if (error instanceof Error) {
          const lowerMessage = error.message.toLowerCase();

          if (lowerMessage.includes('email not confirmed')) {
            const resendResult = await resendConfirmationEmail(trimmedEmail);
            const followUpMessage = resendResult === 'sent'
              ? 'We just sent you a new verification link. Please confirm your email before signing in.'
              : resendResult === 'throttled'
              ? 'You recently requested a verification link. Please wait a couple of minutes and check your inbox.'
              : 'Please confirm your email address before signing in.';
            throw new Error(`Email not confirmed. ${followUpMessage}`);
          }

          if (lowerMessage.includes('invalid login credentials')) {
            throw new Error('Invalid login credentials. Please double-check your email and password.');
          }
        }

        console.error('❌ Supabase login failed:', error);
        throw new Error(error?.message ?? 'Login failed');
      }

      console.log('[login] got session', data.session.user.id);
      await cacheSessionToken(data.session ?? null);
      console.log('[login] cached session token');
      try {
        await syncProfile(data.session.user);
      } catch (syncError) {
        await cacheSessionToken(null);
        console.error('[login] syncProfile failed:', syncError);
        if (syncError instanceof Error) {
          throw syncError;
        }
        throw new Error('Login failed');
      }
      console.log('[login] syncProfile complete');
    },
    [cacheSessionToken, syncProfile]
  );

  const signup = useCallback(
    async (userData: SignupData) => {
      const normalizedEmail = normalizeEmail(userData.email);

      if (userData.role === 'superadmin' && normalizedEmail !== DEFAULT_SUPER_ADMIN_EMAIL.toLowerCase()) {
        throw new Error('Super Admin accounts can only be created by the authorized administrator.');
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: userData.password,
        options: {
          data: {
            role: userData.role,
            name: userData.name,
          },
        },
      });

      if (error) {
        if (error instanceof Error) {
          const lowerMessage = error.message.toLowerCase();

          if (lowerMessage.includes('user already registered')) {
            const resendResult = await resendConfirmationEmail(normalizedEmail);
            const followUpMessage = resendResult === 'sent'
              ? 'We just re-sent your verification link. Please confirm your email to finish creating your account.'
              : resendResult === 'throttled'
              ? 'You recently requested a verification link. Please wait a couple of minutes and check your inbox.'
              : 'If you have not confirmed the address yet, please locate the original verification email in your inbox or request a new one later.';
            throw new Error(`An account with this email already exists. ${followUpMessage}`);
          }
        }

        console.error('❌ Supabase signup failed:', error);
        throw new Error(error.message);
      }

      const authUser = data.user;

      if (authUser && data.session?.user) {
        const profilePayload = {
          id: authUser.id,
          email: normalizedEmail,
          name: userData.name,
          role: userData.role,
          status: 'active' as const,
        };

        const { error: upsertError } = await supabase
          .from('users')
          .upsert(profilePayload, { onConflict: 'id' });

        if (upsertError && upsertError.code !== '23505') {
          console.warn('Supabase user profile upsert failed (continuing):', upsertError.message);
        }

        await cacheSessionToken(data.session ?? null);
        try {
          await syncProfile(authUser);
        } catch (syncError) {
          await cacheSessionToken(null);
          if (syncError instanceof Error) {
            throw syncError;
          }
          throw new Error('Account creation failed');
        }
      } else if (authUser) {
        await resendConfirmationEmail(normalizedEmail);
      }

      const needsEmailVerification = !data.session;

      return {
        success: true,
        message: needsEmailVerification
          ? 'Account created. Please check your email to confirm your address.'
          : 'Account created successfully.',
      };
    },
    [syncProfile]
  );

  const logout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && error.name !== 'AuthSessionMissingError') {
        console.error('❌ Supabase logout failed:', error);
      }
    } catch (err) {
      console.error('❌ Supabase logout threw:', err);
    }

    // Even if Supabase has no active session, make sure local auth state is cleared
    setUser(null);
    await cacheUser(null);
    await cacheAuthToken(null);
  }, [cacheAuthToken, cacheUser]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      login,
      signup,
      logout,
      loading,
    }),
    [loading, login, logout, signup, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
